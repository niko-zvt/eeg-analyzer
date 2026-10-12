"""FastAPI application for EEG BDF Analyzer."""

from __future__ import annotations

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from server.schemas import (
    AmpMultiplierRequest,
    FilterSettingsSchema,
    OpenRequest,
    OpenResponse,
    ProjectLoadRequest,
    ProjectLoadResponse,
    ProjectSaveResponse,
    SegmentResponse,
    SelectRequest,
    SelectResponse,
    SessionStateResponse,
    ZoneCreateRequest,
    ZoneOnAllChannelsRequest,
    ZoneSchema,
    ZoneUpdateRequest,
    SpectrumAnalysisRequest,
    SpectrumAnalysisResponse,
)
from server.service import get_service

app = FastAPI(title="EEG BDF Analyzer API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/session", response_model=SessionStateResponse)
def get_session() -> SessionStateResponse:
    return get_service().get_session_state()


@app.post("/api/open", response_model=OpenResponse)
def open_file(request: OpenRequest) -> OpenResponse:
    try:
        return get_service().open_file(request.path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/select", response_model=SelectResponse)
def select_channels(request: SelectRequest) -> SelectResponse:
    service = get_service()
    try:
        service.select_channels(
            request.channels,
            service_channels=request.service_channels,
            tmin=request.tmin,
            tmax=request.tmax,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    state = service.get_session_state()
    return SelectResponse(
        duration=state.duration,
        selected_channels=state.selected_channels,
        service_channels=state.service_channels,
        zones=state.zones,
    )


@app.get("/api/segment", response_model=SegmentResponse)
def get_segment(
    t0: float = Query(0.0),
    t1: float = Query(...),
    width: int = Query(1000, ge=100, le=8000),
    amp: float | None = Query(None, ge=0.01, le=100.0),
) -> SegmentResponse:
    try:
        return get_service().get_segment(t0, t1, width=width, amp_multiplier=amp)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/amp")
def set_amp_multiplier(request: AmpMultiplierRequest) -> dict[str, float]:
    get_service().set_amp_multiplier(request.value)
    return {"value": request.value}


@app.post("/api/zone-mode")
def set_zone_on_all_channels(request: ZoneOnAllChannelsRequest) -> dict[str, bool]:
    get_service().set_zone_on_all_channels(request.enabled)
    return {"enabled": request.enabled}


@app.post("/api/filters")
def apply_filters(settings: FilterSettingsSchema) -> SessionStateResponse:
    try:
        get_service().apply_filters(settings)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return get_service().get_session_state()


@app.post("/api/filters/reset")
def reset_filters() -> SessionStateResponse:
    try:
        get_service().reset_filters()
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return get_service().get_session_state()


@app.get("/api/zones", response_model=list[ZoneSchema])
def list_zones() -> list[ZoneSchema]:
    return get_service().list_zones()


@app.post("/api/zones", response_model=ZoneSchema)
def create_zone(request: ZoneCreateRequest) -> ZoneSchema:
    import uuid

    data = request.model_dump()
    data["id"] = str(uuid.uuid4())
    return get_service().add_zone(data)


@app.put("/api/zones/{zone_id}", response_model=ZoneSchema)
def update_zone(zone_id: str, request: ZoneUpdateRequest) -> ZoneSchema:
    try:
        return get_service().update_zone(zone_id, request.model_dump(exclude_unset=True))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.delete("/api/zones/{zone_id}")
def delete_zone(zone_id: str) -> dict[str, str]:
    try:
        get_service().delete_zone(zone_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"status": "deleted"}


@app.put("/api/zones", response_model=list[ZoneSchema])
def replace_zones(zones: list[ZoneSchema]) -> list[ZoneSchema]:
    get_service().set_zones(zones)
    return get_service().list_zones()


@app.post("/api/analysis/spectrum", response_model=SpectrumAnalysisResponse)
def analyze_spectrum(request: SpectrumAnalysisRequest) -> SpectrumAnalysisResponse:
    try:
        return get_service().analyze_spectrum(request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/project/save", response_model=ProjectSaveResponse)
def save_project() -> ProjectSaveResponse:
    try:
        return get_service().save_project()
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/project/load", response_model=ProjectLoadResponse)
def load_project(request: ProjectLoadRequest) -> ProjectLoadResponse:
    try:
        return get_service().load_project(request.path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
