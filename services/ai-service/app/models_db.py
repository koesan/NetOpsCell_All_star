import uuid

from sqlalchemy import Column, DateTime, Float, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.db import Base


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    station_code = Column(String, index=True, nullable=False)
    signal_strength = Column(Float, nullable=False)
    packet_loss = Column(Float, nullable=False)
    temperature = Column(Float, nullable=False)
    power_status = Column(String, nullable=False)
    probability = Column(Float, nullable=False)
    predicted_fault_type = Column(String, nullable=False)
    recommendation = Column(String, nullable=False)
    model_version = Column(String, nullable=False)
    incident_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Misclassification(Base):
    __tablename__ = "misclassifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_id = Column(String, index=True, nullable=False)
    original_type = Column(String, nullable=False)
    corrected_type = Column(String, nullable=False)
    corrected_by = Column(String, nullable=True)
    corrected_at = Column(DateTime(timezone=True), server_default=func.now())


class TeamCache(Base):
    __tablename__ = "team_cache"

    team_id = Column(String, primary_key=True)
    name = Column(String, nullable=True)
    expertise = Column(JSONB, nullable=True)
    region = Column(JSONB, nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ModelRegistry(Base):
    __tablename__ = "model_registry"

    version = Column(String, primary_key=True)
    trained_at = Column(DateTime(timezone=True), server_default=func.now())
    metrics = Column(JSONB, nullable=True)
    artifact_path = Column(String, nullable=False)
