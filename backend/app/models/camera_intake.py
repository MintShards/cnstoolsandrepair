from typing import List
from pydantic import BaseModel, Field, field_validator


# Defaults for the Hathorn camera-intake option lists. The live values are a
# singleton document in `camera_intake_config`, editable in Admin Settings →
# Camera Intake — these apply until that document exists (or for any list it
# doesn't carry), so a fresh install behaves like the shipped configuration.

DEFAULT_INCLUDED_OPTIONS = [
    "Power Cord", "Controller", "Patch Cable", "Battery", "Battery Charger",
    "SD Card", "USB Drive", "Carrying Case", "Skids / Guides", "Manual",
]

DEFAULT_CONDITION_OPTIONS = [
    "Powers On", "No Power", "Image OK", "Image Cloudy", "No Image",
    "Bump Test OK", "Bump Test Fails",
    "LEDs OK", "LEDs Dim / Dead", "Sonde Transmits", "Sonde Dead",
    "Odometer Works", "Odometer Faulty",
]

DEFAULT_FINAL_CHECKLIST = [
    "Image Clear",
    "Bump Test Passed",
    "LEDs Working",
    "Sonde Verified",
    "Odometer Verified",
    "Rod Spools Freely",
    "Termination Secure",
    "Accessories Packed",
]


def _clean_list(v):
    seen, out = set(), []
    for item in v or []:
        s = str(item).strip()[:100]
        if s and s.lower() not in seen:
            seen.add(s.lower())
            out.append(s)
    return out


class CameraIntakeConfigUpdate(BaseModel):
    """The three editable option lists for the camera-intake suite.

    final_checklist is what the Ready gate enforces — emptying it turns
    the gate off. Renaming an item effectively unticks it on tools that
    checked the old wording (the gate matches by text, case-insensitive).
    """
    included_options: List[str] = Field(default_factory=lambda: list(DEFAULT_INCLUDED_OPTIONS), max_length=60)
    condition_options: List[str] = Field(default_factory=lambda: list(DEFAULT_CONDITION_OPTIONS), max_length=60)
    final_checklist: List[str] = Field(default_factory=lambda: list(DEFAULT_FINAL_CHECKLIST), max_length=60)

    @field_validator('included_options', 'condition_options', 'final_checklist', mode='before')
    @classmethod
    def clean_lists(cls, v):
        return _clean_list(v)


class CameraIntakeConfigResponse(CameraIntakeConfigUpdate):
    pass
