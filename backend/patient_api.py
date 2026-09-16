from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from database import database, init_indexes


app = FastAPI(title="CVD-XAI Patient API")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PatientCreate(BaseModel):
    patientId: str = Field(min_length=1)
    name: str = Field(min_length=1)
    age: int = Field(ge=1, le=120)
    gender: str
    phone: str = ""
    email: str = ""
    bloodPressure: str = ""
    cholesterol: str = ""
    heartRate: str = ""
    diabetes: str = "No"
    smoking: str = "No"
    familyHistory: str = ""


@app.on_event("startup")
def startup():
    init_indexes()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/patients", status_code=201)
def create_patient(patient: PatientCreate):

    existing_patient = database["patients"].find_one(
        {"patientId": patient.patientId}
    )

    if existing_patient:
        raise HTTPException(
            status_code=409,
            detail="Patient ID already exists."
        )

    patient_data = patient.model_dump()

    patient_data["createdAt"] = datetime.now(timezone.utc)

    result = database["patients"].insert_one(patient_data)

    patient_data["_id"] = str(result.inserted_id)

    return patient_data