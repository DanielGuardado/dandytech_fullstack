# Session Management

[← Back to Purchase Calculator Documentation](./README.md)

## Overview for Humans

Calculator sessions are containers for grouping related purchase calculations. Think of them as "deal sheets" where you can analyze multiple items from the same seller or buying opportunity, set an overall asking price, and see how the costs and profits distribute across all items.

### Key Concepts
- **Session**: A collection of items being evaluated together
- **Asking Price**: Total amount the seller is asking for all items
- **Allocation**: How the asking price is distributed among items
- **Status**: Draft, Finalized, or Converted to Purchase Order

### User Experience
1. **Create Session**: Name it (e.g., "GameStop Lot - Aug 2025") and set asking price
2. **Add Items**: Search and add products with their conditions and market values
3. **Review Allocation**: System automatically distributes asking price based on market values
4. **Manual Adjustments**: Override individual purchase prices as needed
5. **Track Progress**: Monitor total profit margin across all items

---

## Technical Implementation

### Database Schema

#### calculator_sessions Table
```sql
CREATE TABLE calculator_sessions (
    session_id INT IDENTITY(1,1) PRIMARY KEY,
    session_name NVARCHAR(255) NOT NULL,
    asking_price DECIMAL(10,2) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
```

#### calculator_items Table
```sql
CREATE TABLE calculator_items (
    item_id INT IDENTITY(1,1) PRIMARY KEY,
    session_id INT NOT NULL,
    catalog_product_id INT NOT NULL,
    variant_id INT NOT NULL,
    estimated_sale_price DECIMAL(10,2) NOT NULL,
    purchase_price DECIMAL(10,2) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    custom_deductions DECIMAL(10,2) NULL DEFAULT 0,
    deductions DECIMAL(10,2) NULL DEFAULT 0,
    deduction_reasons NVARCHAR(500) NULL,
    has_manual BIT NULL,
    notes NVARCHAR(1000) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    FOREIGN KEY (session_id) REFERENCES calculator_sessions(session_id)
);
```

### Backend Implementation

#### Service Layer (`CalculatorService`)
```python
class CalculatorService:
    def create_session(self, payload) -> dict:
        session_id = self.repo.create_session(
            session_name=payload.session_name,
            asking_price=payload.asking_price
        )
        return self.get_session(session_id)
    
    def get_session(self, session_id: int) -> dict:
        session_data = self.repo.get_session(session_id)
        items = self.repo.get_session_items(session_id)
        
        # Calculate totals
        totals = self._calculate_session_totals(items)
        
        return {
            **session_data,
            "items": items,
            "totals": totals
        }
```

#### Repository Layer (`CalculatorRepo`)
```python
def create_session(self, session_name: str, asking_price: Optional[float]) -> int:
    row = self.db.execute(text("""
        INSERT INTO calculator_sessions (session_name, asking_price, status)
        OUTPUT inserted.session_id
        VALUES (:name, :price, 'draft')
    """), {
        "name": session_name,
        "price": asking_price
    }).fetchone()
    return int(row[0])

def get_session_items(self, session_id: int) -> List[Dict]:
    return self.db.execute(text("""
        SELECT ci.*, cp.title as product_title, vt.code as variant_type_code
        FROM calculator_items ci
        JOIN CatalogProducts cp ON cp.catalog_product_id = ci.catalog_product_id  
        JOIN ListingVariants lv ON lv.variant_id = ci.variant_id
        JOIN VariantTypes vt ON vt.variant_type_id = lv.variant_type_id
        WHERE ci.session_id = :session_id
        ORDER BY ci.created_at
    """), {"session_id": session_id}).mappings().all()
```

### Frontend Implementation

#### State Management
```typescript
// Session state in PurchaseCalculator.tsx
const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
const [dynamicSessionData, setDynamicSessionData] = useState<SessionDetails | null>(null);

// Load session data
const loadSessionData = useCallback(async (sessionId: number) => {
  try {
    const sessionData = await calculatorService.getSession(sessionId);
    setDynamicSessionData(sessionData);
  } catch (error) {
    setError(`Failed to load session: ${error}`);
  }
}, []);
```

#### Session Selection UI
```typescript
<select 
  value={selectedSessionId || ''} 
  onChange={(e) => handleSessionChange(e.target.value)}
>
  <option value="">Select Session...</option>
  {sessions.map(session => (
    <option key={session.session_id} value={session.session_id}>
      {session.session_name} - {formatCurrency(session.asking_price || 0)}
    </option>
  ))}
</select>
```

### Allocation Logic

#### Cost Assignment Methods
1. **By Market Value** (Default): Distribute asking price proportionally based on estimated sale prices
2. **Manual**: User sets individual purchase prices directly

#### Calculation Example
```typescript
// Proportional allocation by market value
const totalMarketValue = items.reduce((sum, item) => sum + item.estimated_sale_price, 0);
const allocationFactor = askingPrice / totalMarketValue;

items.forEach(item => {
  item.allocated_purchase_price = item.estimated_sale_price * allocationFactor;
});
```

### Session Status Workflow

#### Status Transitions
- **draft** → **finalized**: Lock in calculations, no more edits
- **finalized** → **converted_to_po**: Create purchase order from session
- All statuses can return to **draft** for modifications

#### Business Rules
- Draft sessions allow full editing
- Finalized sessions are read-only but can be reopened
- Converted sessions maintain audit trail to purchase orders

### API Integration

#### Key Endpoints
- `GET /api/v1/calculator/sessions` - List all sessions
- `POST /api/v1/calculator/sessions` - Create new session
- `GET /api/v1/calculator/sessions/{id}` - Get session with items
- `PUT /api/v1/calculator/sessions/{id}` - Update session metadata

#### Response Caching
Frontend caches session list and refreshes on:
- Session creation/update
- Item addition/removal
- Manual refresh request

### Common Patterns

#### Session Creation Flow
1. User clicks "New Session"
2. Modal prompts for name and asking price
3. POST request creates session
4. Session list refreshes
5. New session auto-selected

#### Item Addition Impact
1. Item added to session via AddLineItemFlow
2. Session totals recalculated
3. Allocation percentages updated
4. UI refreshes with new totals

#### Error Handling
- Network failures show retry options
- Validation errors highlight specific fields  
- Concurrent modifications detected and resolved