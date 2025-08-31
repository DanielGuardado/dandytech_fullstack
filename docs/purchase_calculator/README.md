# Purchase Calculator System Documentation

## Overview for Humans

The Purchase Calculator is a comprehensive tool for calculating optimal purchase prices for gaming products based on market values, fees, and profit margins. It helps determine how much to offer sellers while accounting for all selling costs and desired profit margins.

### Key Features
- **Session Management**: Create and manage calculation sessions for different buying scenarios
- **Product Search & Selection**: Find products from the catalog with real-time market pricing
- **Platform Manual Sensitivity**: Automatic deductions for platforms where manuals affect CIB pricing
- **Fee Calculations**: Comprehensive fee modeling including eBay fees, shipping, supplies, and taxes
- **Profit Margin Analysis**: Real-time profit calculations with configurable target margins
- **Bulk Item Management**: Add multiple items to sessions with individual customization

### User Workflow
1. **Create Session**: Start a new calculation session or load an existing one
2. **Add Items**: Search catalog, select products and variants (NEW, CIB, Loose, etc.)
3. **Price Analysis**: System calculates optimal purchase price based on market value and fees
4. **Manual Adjustments**: Override prices, add custom deductions, adjust quantities
5. **Session Review**: View totals, profit margins, and export data

---

## Technical Architecture

### Frontend Components
- **PurchaseCalculator.tsx**: Main container with 3-panel layout
- **AddLineItemFlow.tsx**: Multi-step product selection and pricing workflow  
- **CalculatorPricingPanel.tsx**: Core pricing calculations and manual sensitivity logic
- **SessionItemsTable.tsx**: Bulk item management with inline editing

### Backend Services
- **CalculatorService**: Session and item CRUD operations
- **CatalogService**: Product search with platform sensitivity data
- **Fee calculation logic**: Complex fee modeling based on configurable rules

### Database Schema
- **calculator_sessions**: Session metadata and totals
- **calculator_items**: Individual line items with pricing details
- **Platforms**: Manual sensitivity configuration
- **Catalog integration**: Products, variants, and market pricing

---

## Feature Documentation

### Core Features
- [**Session Management**](./session_management.md) - Creating, loading, and managing calculation sessions
- [**Product Search & Selection**](./product_search_selection.md) - Catalog search, product creation, and variant selection
- [**Platform Manual Sensitivity**](./platform_manual_sensitivity_implementation.md) - Automatic deductions for manual-sensitive platforms
- [**Fee Calculations**](./fee_calculations.md) - Comprehensive fee modeling and profit margin analysis
- [**Bulk Item Management**](./bulk_item_management.md) - Adding, editing, and managing multiple items

### Technical Implementation
- [**API Endpoints**](./api_endpoints.md) - Complete REST API reference
- [**Database Schema**](./database_schema.md) - Tables, relationships, and data flow
- [**Frontend Architecture**](./frontend_architecture.md) - Component structure and state management
- [**Configuration System**](./configuration_system.md) - Fee rules, margins, and settings management

---

## Quick Start Guide

### For Developers
1. **Backend**: FastAPI server with SQL Server database
2. **Frontend**: React TypeScript with CSS modules
3. **Key APIs**: `/api/v1/calculator/*` and `/api/v1/catalog/*`
4. **Development**: `npm start` (frontend) + `uvicorn app.main:app --reload` (backend)

### For Users
1. Navigate to Purchase Calculator section
2. Create new session or select existing
3. Search and add products using the "+ Add Item" flow
4. Review calculations and adjust as needed
5. Use session data for purchasing decisions

---

## Common Workflows

### Adding a PS3 Game (Manual-Sensitive)
1. Search "Spider-Man PS3" → Select product → Choose CIB variant
2. System shows yellow warning box with manual sensitivity
3. Toggle "Includes Manual" (defaults to true) 
4. If no manual: automatic deduction applied to purchase price
5. Review final purchase price recommendation

### Adding a PS5 Game (Non-Manual-Sensitive)  
1. Search "Spider-Man PS5" → Select product → Choose CIB variant
2. System shows blue informational box for tracking
3. Toggle "Includes Manual" (defaults to false, no price impact)
4. Manual status tracked but doesn't affect purchase price
5. Review final purchase price recommendation

### Bulk Session Management
1. Create session with multiple items from same seller
2. Set asking price for entire lot
3. Individual items show calculated allocations
4. Adjust quantities, conditions, or custom pricing
5. Monitor total profit margin across all items