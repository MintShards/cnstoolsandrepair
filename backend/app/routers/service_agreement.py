from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from app.database import get_database
from app.models.service_agreement import ServiceAgreementUpdate, ServiceAgreementResponse
from app.utils.helpers import convert_objectid_to_str
from app.dependencies.auth import require_admin


router = APIRouter(prefix="/api/service-agreement", tags=["service-agreement"])


DEFAULT_SERVICE_AGREEMENT = {
    "sections": [
        {
            "title": "Warranty Coverage",
            "items": [
                {"text": "A 1-month warranty is provided on all parts replaced and labour performed, under normal use and conditions."},
                {"text": "Warranty does not cover: normal wear and tear, misuse, improper use, poor maintenance (including air supply issues), accidental or external damage, or parts or components not listed on this work order."},
                {"text": "Warranty is void if the tool is opened, modified, or repaired by anyone other than CNS Tool Repair."},
                {"text": "All warranty claims require in-shop inspection. Our technicians will assess whether the failure is covered."},
            ],
        },
        {
            "title": "Air Supply Requirements",
            "items": [
                {"text": "Tools must be operated with clean, dry, regulated air at 90 PSI."},
                {"text": "Minimum 3/8\" air hose required. For high-demand tools, 1/2\" hose is strongly recommended."},
                {"text": "Operating outside these requirements may cause poor performance, premature wear, or damage — and will void the warranty."},
            ],
        },
        {
            "title": "General",
            "items": [
                {"text": "CNS Tool Repair is not liable for pre-existing damage identified at intake and noted on this work order, or damage unrelated to the repair performed."},
                {"text": "Estimates are provided free of charge. If a repair is declined, the tool will be returned in a disassembled state. Reassembly is not included. Do not attempt to operate a disassembled tool — doing so may cause injury or further damage."},
                {"text": "Unclaimed tools after 30 days will be considered abandoned and may be disposed of or sold to recover costs."},
            ],
        },
    ]
}


@router.get("/", response_model=ServiceAgreementResponse)
async def get_service_agreement():
    """Public endpoint to fetch the current service agreement."""
    db = get_database()
    doc = await db.service_agreement.find_one({"active": True})
    if not doc:
        return ServiceAgreementResponse(**DEFAULT_SERVICE_AGREEMENT)
    doc = convert_objectid_to_str(doc)
    return ServiceAgreementResponse(**doc)


@router.put("/", response_model=ServiceAgreementResponse, dependencies=[Depends(require_admin)])
async def update_service_agreement(data: ServiceAgreementUpdate):
    """Admin endpoint to update the service agreement."""
    db = get_database()
    payload = data.model_dump()
    payload["active"] = True
    payload["updatedAt"] = datetime.utcnow()

    await db.service_agreement.update_one(
        {"active": True},
        {
            "$set": payload,
            "$setOnInsert": {"createdAt": datetime.utcnow()},
        },
        upsert=True,
    )

    doc = await db.service_agreement.find_one({"active": True})
    if not doc:
        raise HTTPException(status_code=500, detail="Failed to save service agreement")

    doc = convert_objectid_to_str(doc)
    return ServiceAgreementResponse(**doc)
