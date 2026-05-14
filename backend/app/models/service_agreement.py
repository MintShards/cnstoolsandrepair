from pydantic import BaseModel
from typing import List


class ServiceAgreementItem(BaseModel):
    text: str


class ServiceAgreementSection(BaseModel):
    title: str
    items: List[ServiceAgreementItem]


class ServiceAgreementUpdate(BaseModel):
    sections: List[ServiceAgreementSection]


class ServiceAgreementResponse(BaseModel):
    sections: List[ServiceAgreementSection]
