from datetime import date

from pydantic import BaseModel, ConfigDict, Field, StrictBool, field_validator, model_validator


class InventoryPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    uniforms: int = Field(default=0, ge=0, le=100, strict=True)
    vest: StrictBool = False
    id_card: StrictBool = False
    ktp_verified: StrictBool = False
    received_on: str = Field(default="", max_length=10)
    returned_on: str = Field(default="", max_length=10)
    note: str = Field(default="", max_length=2000)

    @field_validator("received_on", "returned_on")
    @classmethod
    def valid_date(cls, value):
        if value:
            if date.fromisoformat(value).isoformat() != value:
                raise ValueError("Tanggal harus YYYY-MM-DD")
        return value


class MarketingProfilePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    phone: str = Field(default="", max_length=30)
    joined_on: str = Field(default="", max_length=10)
    is_active: StrictBool = True
    bank: str = Field(default="", max_length=100)
    account_number: str = Field(default="", max_length=40)
    account_holder: str = Field(default="", max_length=150)
    inventory: InventoryPatch = Field(default_factory=InventoryPatch)

    @field_validator("joined_on")
    @classmethod
    def valid_date(cls, value):
        return InventoryPatch.valid_date(value)

    @field_validator("phone", "bank", "account_number", "account_holder")
    @classmethod
    def trim_text(cls, value):
        return value.strip()

    @field_validator("account_number")
    @classmethod
    def valid_account(cls, value):
        if value and not value.isascii():
            raise ValueError("Nomor rekening hanya boleh berisi angka dan spasi")
        if value and not value.replace(" ", "").isdigit():
            raise ValueError("Nomor rekening hanya boleh berisi angka dan spasi")
        return value


class MarketingRegistrationProfile(MarketingProfilePatch):
    phone: str = Field(min_length=1, max_length=30)
    joined_on: str = Field(min_length=1, max_length=10)
    bank: str = Field(min_length=1, max_length=100)
    account_number: str = Field(min_length=1, max_length=40)
    account_holder: str = Field(min_length=1, max_length=150)

    @field_validator("phone", "joined_on", "bank", "account_number", "account_holder")
    @classmethod
    def required_text(cls, value):
        if not value.strip():
            raise ValueError("Wajib diisi")
        return value

    @field_validator("phone")
    @classmethod
    def valid_phone(cls, value):
        digits = "".join(char for char in value if char.isdigit())
        if not 8 <= len(digits) <= 20 or any(char not in "+0123456789 ()-" for char in value):
            raise ValueError("Nomor HP tidak valid")
        return value

    @model_validator(mode="after")
    def inventory_dates(self):
        inventory = self.inventory
        if (inventory.uniforms or inventory.vest or inventory.id_card) and not inventory.received_on:
            raise ValueError("Tanggal penyerahan wajib untuk perlengkapan yang diterima")
        if inventory.returned_on and (not inventory.received_on or inventory.returned_on < inventory.received_on):
            raise ValueError("Tanggal pengembalian harus setelah tanggal penyerahan")
        return self


def profile_values(doc):
    stored = doc.get("profile") or {}
    defaults = MarketingProfilePatch().model_dump()
    return {
        **defaults,
        **stored,
        "inventory": {**defaults["inventory"], **(stored.get("inventory") or {})},
    }


def profile_update(input):
    # Dotted updates preserve stored fields omitted by older or partial clients.
    values = input.model_dump(exclude_unset=True)
    update = {}
    for key, value in values.items():
        if key == "inventory":
            update.update({f"profile.inventory.{field}": item for field, item in value.items()})
        else:
            update[f"profile.{key}"] = value
    return update
