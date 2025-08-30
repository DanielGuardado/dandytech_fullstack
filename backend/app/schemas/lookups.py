from pydantic import BaseModel, Field

class SourceCreate(BaseModel):
    code: str = Field(..., description="Short code like EB/MC/WM (2-20 chars)")
    name: str = Field(..., description="Display name")
    type: str = Field(..., description="Marketplace | Retail | PrivateParty | Wholesale | Other")

class PaymentMethodCreate(BaseModel):
    code: str = Field(..., description="Unique code (e.g., BankTransfer)")
    display_name: str = Field(..., description="Human-friendly name")
