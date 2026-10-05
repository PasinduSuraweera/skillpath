"""SkillPath web API (Stage 9).

    uvicorn app.main:app --reload          then open http://127.0.0.1:8000/docs

Endpoints
---------
GET  /api/health    the service is up and the model is loaded
GET  /api/options   every valid answer, for building the form
POST /api/predict   profile in, top-3 job roles + families + insights out

Nothing the user sends is stored or logged.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from skillpath import __version__

from .schemas import OPTIONS, Profile, Recommendation
from .service import Recommender


@asynccontextmanager
async def lifespan(app: FastAPI):
    # load the model once at startup, not on every request
    app.state.recommender = Recommender()
    yield


app = FastAPI(
    title="SkillPath API",
    version=__version__,
    description="AI-aware developer job role and career path recommendations, trained on the "
                "Stack Overflow Annual Developer Survey 2025 (ODbL v1.0).",
    lifespan=lifespan,
)


@app.exception_handler(RequestValidationError)
async def invalid_input(request: Request, exc: RequestValidationError):
    """Return one readable message per invalid field instead of pydantic's raw error list."""
    fields = []
    for err in exc.errors():
        # a JSON syntax error is located by character position, which means nothing to a user
        loc = [] if err["type"] == "json_invalid" else [str(p) for p in err["loc"] if p != "body"]
        msg = err["msg"].removeprefix("Value error, ")
        fields.append({"field": ".".join(loc) or "body", "message": msg})
    return JSONResponse(status_code=422, content={
        "error": "invalid_input",
        "message": "Some answers are not valid. Please correct the fields listed.",
        "fields": fields,
    })


@app.get("/api/health")
def health(request: Request) -> dict:
    return {"status": "ok", "version": __version__, "model": request.app.state.recommender.info()["name"]}


@app.get("/api/options")
def options() -> dict:
    return OPTIONS


@app.post("/api/predict", response_model=Recommendation)
def predict(profile: Profile, request: Request) -> dict:
    return request.app.state.recommender.recommend(profile.model_dump())
