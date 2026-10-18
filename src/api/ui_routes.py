#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
面向本地 Web 界面的同源路由

与公共 /api/v1/* 接口保持隔离：本文件只新增 /ui/api/* 端点，由同一 FastAPI
进程托管的前端页面直接调用（等价于旧版 Streamlit 直连协调器的行为，无需 API Key）。
"""

from datetime import datetime
import math
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from src.agents.coordinator_agent import (
    ResearchTask,
    TaskPriority,
    coordinator,
)
from src.core.config import settings
from src.utils.device_manager import device_manager


router = APIRouter(prefix="/ui/api", tags=["ui"])


def json_safe(value):
    """清洗返回值，保证一定能被 JSON 序列化。

    Starlette 的 JSONResponse 使用 json.dumps(allow_nan=False)，任何 NaN/Infinity
    都会让整个响应抛 500（表现为浏览器里"无法读取结果 HTTP 500"）。
    这里把非有限浮点数换成 null，并把 numpy 标量转成 Python 原生类型。
    """
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if value is None or isinstance(value, (str, bool, int)):
        return value
    if isinstance(value, dict):
        return {key: json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [json_safe(item) for item in value]

    # numpy 标量（np.float64 之外还有 np.int64 / np.bool_ 等）走 .item()
    item_method = getattr(value, "item", None)
    if callable(item_method):
        try:
            return json_safe(item_method())
        except Exception:  # noqa: BLE001
            pass
    return value


class UiResearchRequest(BaseModel):
    """Web 界面研究任务请求"""
    query: str
    domains: Optional[List[str]] = None
    depth: str = "comprehensive"
    include_patents: bool = False
    generate_hypotheses: bool = True
    trl_assessment: bool = True
    priority: str = "medium"


PRIORITY_MAP = {
    "low": TaskPriority.LOW,
    "medium": TaskPriority.MEDIUM,
    "high": TaskPriority.HIGH,
    "urgent": TaskPriority.URGENT,
}


@router.get("/system")
async def system_info():
    """系统信息（设备 + 实时资源 + 版本）"""
    device_info = device_manager.get_device_info()
    resources = device_manager.monitor_resources()
    return {
        "device": device_info,
        "resources": resources,
        "version": settings.APP_VERSION,
        "server_time": datetime.now().isoformat(),
    }


@router.get("/system/logs")
async def system_logs(lines: int = Query(default=200, ge=1, le=2000)):
    """读取最新的应用日志尾部（路径限定在 LOG_DIR 内）"""
    log_dir = Path(settings.LOG_PATH)
    if not log_dir.exists():
        raise HTTPException(status_code=404, detail="暂无日志")

    candidates = sorted(log_dir.glob("ai4_science_*.log"))
    if not candidates:
        candidates = sorted(log_dir.glob("*.log"))
    if not candidates:
        raise HTTPException(status_code=404, detail="暂无日志")

    latest = candidates[-1]
    tail = latest.read_text(encoding="utf-8", errors="replace").splitlines()[-lines:]
    return {
        "filename": latest.name,
        "size": latest.stat().st_size,
        "lines": tail,
    }


@router.post("/research/submit")
async def submit_research(request: UiResearchRequest):
    """提交研究任务（等价于 /api/v1/research/submit，但不要求 API Key）"""
    try:
        import uuid

        task = ResearchTask(
            task_id=str(uuid.uuid4()),
            query=request.query,
            domains=request.domains or [],
            depth=request.depth,
            include_patents=request.include_patents,
            generate_hypotheses=request.generate_hypotheses,
            trl_assessment=request.trl_assessment,
            priority=PRIORITY_MAP.get(request.priority.lower(), TaskPriority.MEDIUM),
        )
        await coordinator.submit_task(task)
        return {
            "task_id": task.task_id,
            "status": "submitted",
            "message": "任务已提交，正在处理中",
        }
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/research/tasks")
async def list_tasks():
    """列出当前进程内的全部任务，按创建时间倒序"""
    tasks = [task.to_dict() for task in coordinator.tasks.values()]
    tasks.sort(key=lambda item: item.get("created_at") or "", reverse=True)
    return {"total": len(tasks), "tasks": tasks}


@router.get("/research/status/{task_id}")
async def task_status(task_id: str):
    """获取任务状态"""
    status = coordinator.get_task_status(task_id)
    if not status:
        raise HTTPException(status_code=404, detail="任务不存在")
    return status


@router.get("/research/result/{task_id}")
async def task_result(task_id: str):
    """获取任务结果"""
    result = coordinator.get_task_result(task_id)
    if not result:
        status = coordinator.get_task_status(task_id)
        if not status:
            raise HTTPException(status_code=404, detail="任务不存在")
        if status["status"] != "completed":
            raise HTTPException(status_code=400, detail="任务尚未完成")
        raise HTTPException(status_code=500, detail="无法获取任务结果")
    return json_safe(result)


@router.delete("/research/cancel/{task_id}")
async def cancel_task(task_id: str):
    """取消任务"""
    if not coordinator.cancel_task(task_id):
        raise HTTPException(status_code=400, detail="无法取消任务")
    return {"message": "任务已取消"}


@router.get("/research/report/{task_id}")
async def task_report(task_id: str, format: str = Query(default="markdown")):
    """读取任务报告正文（markdown 或 html），路径严格限定在 REPORT_DIR 内"""
    extension = {"markdown": "md", "html": "html"}.get(format)
    if not extension:
        raise HTTPException(status_code=400, detail="不支持的格式，仅支持 markdown 或 html")

    report_dir = Path(settings.REPORT_DIR).resolve()
    candidate = (report_dir / f"report_{task_id}.{extension}").resolve()

    # 目录穿越防护：解析后的路径必须仍然位于报告目录内
    if candidate.parent != report_dir:
        raise HTTPException(status_code=400, detail="非法路径")
    if not candidate.exists():
        raise HTTPException(status_code=404, detail="报告尚未生成")

    content = candidate.read_text(encoding="utf-8", errors="replace")
    return {
        "task_id": task_id,
        "format": format,
        "filename": candidate.name,
        "size": candidate.stat().st_size,
        "content": content,
    }
