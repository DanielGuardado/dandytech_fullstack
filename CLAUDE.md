# Frontend Design Guidelines

## Core Design Philosophy
- **Desktop-first**: Optimize for keyboard navigation and desktop workflows
- **Full screen utilization**: Make use of all available screen real estate
- **Speed over aesthetics**: Prioritize fast user interactions over visual polish
- **Minimal clicks**: Group related actions, reduce interaction steps
- **Information density**: Show more data by default, allow users to trim down
- **Sleek but functional**: Clean design that doesn't sacrifice usability
- **Spreadsheet-like interactions**: Use table/grid layouts with keyboard navigation for bulk editing

## User Experience Principles
- Keyboard shortcuts for all major actions
- Bulk operations where applicable
- Inline editing capabilities (like Excel/Google Sheets)
- Quick search/filter functionality
- Context menus and right-click actions
- Arrow key navigation between cells/fields
- Enter/Tab to move between form fields efficiently

## Technical Standards
- **React**: Functional components with hooks (standard modern React)
- **TypeScript**: Strict typing throughout
- **CSS**: CSS Modules or styled-components (will determine based on project needs)
- **State Management**: React Context + useReducer for complex state, useState for simple
- **Forms**: Controlled components with proper validation
- **HTTP**: Fetch API with proper error handling
- **Code Organization**: Feature-based folder structure

## Component Patterns
- **Modal/Dialog**: Standard portal-based modals with keyboard escape
- **Navigation**: Clean sidebar/header navigation
- **Loading States**: Skeleton screens and inline loaders
- **Error Handling**: Toast notifications and inline field errors
- **Data Tables**: Sortable, filterable tables with keyboard navigation
- **Form Patterns**: Multi-step forms with progress indicators

## UI Design System & Styling Standards

### Button Styling
- **Primary action buttons**: `background: #007bff, color: white, padding: 8px 16px, fontSize: 12px, borderRadius: 3px, fontWeight: bold`
- **Secondary/Back buttons**: `background: transparent, border: 1px solid #6c757d, color: #6c757d, padding: 4px 8px, fontSize: 10px, borderRadius: 3px`
- **Danger/Cancel buttons**: `background: #dc3545, color: white, padding: 4px 8px, fontSize: 10px, borderRadius: 3px, fontWeight: bold`
- **Disabled state**: Use `#6c757d` background with `not-allowed` cursor

### Form Controls & Input Patterns

#### **Input Field Styling**
- **Text inputs**: `padding: 8px 12px, border: 1px solid #dee2e6, borderRadius: 4px, fontSize: 14px, width: 100%`
- **Number inputs**: `padding: 6px 10px, textAlign: right, fontFamily: monospace` for currency/numeric values
- **Select dropdowns**: `padding: 4px 6px, border: 1px solid #6c757d, borderRadius: 3px, fontSize: 10px` (small) or `padding: 8px 12px, fontSize: 14px` (standard)
- **Textareas**: `padding: 8px 12px, minHeight: 60px, resize: vertical, fontSize: 14px`

#### **Form Labels & Structure**
- **Labels**: `fontSize: 12px, fontWeight: bold, color: #6c757d, marginBottom: 4px, textTransform: uppercase, display: block`
- **Form sections**: `marginBottom: 16px` between field groups
- **Field spacing**: `marginBottom: 12px` between individual fields
- **Form container**: `padding: 12px, overflow: auto` with flex column layout

#### **Input States**
- **Focus states**: `borderColor: #007aff, boxShadow: 0 0 0 3px rgba(0, 122, 255, 0.15)`
- **Disabled states**: `background: #f8f9fa, color: #6c757d, cursor: not-allowed`
- **Readonly/locked**: Gray background with muted text, often with `fontFamily: monospace` for data display
- **Validation errors**: Red border and background tints with error messaging

#### **Specialized Input Patterns**
- **Currency displays**: `fontFamily: monospace, fontWeight: bold, fontSize: 18px, color: #28a745` for prominent totals
- **Compact currency**: `fontFamily: monospace, fontSize: 12px` for summary bars
- **Status badges**: Colored text/backgrounds with specific styling for different states
- **Auto-focus**: Set focus to first field or most relevant input on load

### Layout Patterns

#### **Viewport & Container Management**
- **Root container**: `height: 100%, display: flex, flexDirection: column, overflow: hidden` (no page scrolling)
- **Main content area**: `display: flex, flex: 1, gap: 8px, minHeight: 0, overflow: hidden` (3-column layout)
- **Column containers**: `border: 1px solid #dee2e6, borderRadius: 4px, background: #fff, display: flex, flexDirection: column`
- **Responsive widths**: Left sidebar `280px` (with flow) or `320px` (without), middle section `flex: 1`, right panel `400px`

#### **Section Headers & Actions**
- **Component headers**: `padding: 6px 12px, borderBottom: 1px solid #dee2e6, display: flex, justifyContent: space-between, alignItems: center, minHeight: 32px`
- **Section headers**: `padding: 10px 16px` (larger sections), `padding: 4px 8px` (compact sections)
- **Action groups**: `display: flex, gap: 8px, alignItems: center`
- **Header titles**: `fontSize: 16px, fontWeight: bold, color: #1d1d1f, margin: 0`

#### **Content Areas**
- **Form content**: `padding: 12px, background: #fff, overflow: auto`
- **Table content**: `flex: 1, overflow: hidden` with scrollable tbody
- **Summary bars**: `padding: 8px 16px, background: #f8f9fa, border: 1px solid #dee2e6, borderRadius: 4px, height: 32px`

### Color Palette
- **Primary blue**: `#007bff` (buttons, links, focus states)
- **Text colors**: `#1d1d1f` (headers), `#495057` (body), `#6c757d` (secondary/muted)
- **Borders**: `#dee2e6` (light), `#6c757d` (medium)
- **Backgrounds**: `#fff` (content), `#f8f9fa` (subtle background)
- **Success**: `#28a745`, **Warning**: `#ffc107`, **Danger**: `#dc3545`

### Typography Scale
- **Section headers**: `fontSize: 16px, fontWeight: bold`
- **Subsection headers**: `fontSize: 14px, fontWeight: bold`  
- **Component headers**: `fontSize: 12px, fontWeight: bold`
- **Body text**: `fontSize: 12px` (forms), `fontSize: 13px` (tables)
- **Small UI text**: `fontSize: 11px` (summaries), `fontSize: 10px` (buttons, controls)

## Implementation Best Practices

### Component State Management
- **Local component state**: Use `useState` for UI state (selected items, form values, toggles)
- **Derived state**: Calculate values from props/state rather than storing separately
- **Mode selection patterns**: Use dropdowns for default behaviors (like variant mode selector)
- **Prop drilling**: Pass simple values down, avoid complex objects when possible

### User Experience Patterns
- **Contextual controls**: Place mode selectors and options close to where they're used (e.g., variant selector in AddLineItem header)
- **Clear labeling**: Be specific with labels ("Variant default:" not just "Default:")
- **Consistent interactions**: Match styling across similar UI elements
- **Immediate feedback**: Update UI state instantly, sync with backend asynchronously

### Layout & Positioning
- **Header actions**: Group related controls in component headers with consistent spacing
- **Flex layouts**: Use `display: flex, gap: Npx, alignItems: center` for action groups
- **Responsive spacing**: Use 8px increments (4px, 8px, 12px, 16px) for consistent spacing
- **Visual hierarchy**: Larger/bolder for primary actions, smaller/muted for secondary

### Code Organization
- **Component interfaces**: Always type props with TypeScript interfaces
- **Optional props**: Use `prop?: type` for optional values, provide sensible defaults
- **Internal state**: Prefix internal state with component name when needed to avoid conflicts
- **Effect dependencies**: Include all dependencies in useEffect arrays, especially for derived state

## PurchaseOrderCreate Architecture Reference

This page exemplifies our design system principles:

### **Multi-Panel Layout**
- **Fixed viewport**: No page scrolling, all content within viewport bounds
- **3-column responsive**: Form sidebar (280-320px) + data table (flex) + optional flow panel (400px)
- **Column collapsing**: Sidebar shrinks when flow panel opens for optimal space usage
- **Individual scroll**: Each panel has its own scrolling when content exceeds height

### **State Management Patterns**
- **Form state**: Controlled inputs with immediate UI updates, batch API calls
- **Edit modes**: Toggle states for inline editing with save/cancel actions
- **Loading states**: Button text changes, disabled states, and spinner animations
- **Validation feedback**: Real-time validation with visual feedback and error states

### **Interaction Patterns**
- **Auto-focus**: Focus management for keyboard workflows (source field → form flow)
- **Auto-scroll**: Scroll to newly added content (line items table)
- **Mode persistence**: User preferences maintained during session (variant defaults)
- **Contextual actions**: Actions appear where they're needed (edit buttons in table rows)

### **Performance Considerations**
- **Ref-based scrolling**: Use refs for programmatic scrolling instead of state
- **Computed values**: Calculate totals and summaries from state, don't store separately
- **Conditional rendering**: Show/hide panels and sections based on state without re-mounting
- **Minimal re-renders**: Use specific state updates to avoid cascading re-renders

## Data Display & Table Patterns

### **Table Structure**
- **Container**: `overflow: hidden` with `flex: 1` to fill available space
- **Table element**: `width: 100%, borderCollapse: collapse, fontSize: 13px`
- **Header styling**: `background: #f8f9fa, borderBottom: 2px solid #dee2e6, position: sticky, top: 0, zIndex: 1`
- **Header cells**: `padding: 8px 10px, fontWeight: bold, color: #6c757d, textTransform: uppercase, fontSize: 11px`
- **Body container**: `overflow: auto, flex: 1` for scrollable content

### **Table Cell Patterns**
- **Standard cells**: `padding: 8px 10px, fontSize: 13px, borderBottom: 1px solid #e9ecef`
- **Numeric cells**: `textAlign: right, fontFamily: monospace, fontWeight: bold` for currency/numbers
- **Action cells**: `textAlign: center, padding: 6px 8px` with compact buttons
- **Row striping**: Alternating `#fff` and `#f9f9f9` backgrounds
- **Hover states**: `backgroundColor: #e3f2fd` on mouse enter

### **Inline Editing**
- **Edit mode inputs**: `padding: 2px 4px, border: 1px solid #007bff, borderRadius: 2px, fontSize: 11px`
- **Number inputs**: `width: 60-70px, textAlign: right/center, fontFamily: monospace`
- **Edit triggers**: Click to edit, auto-focus, Enter to save, Escape to cancel
- **Visual feedback**: Blue border during editing, disabled appearance when locked

### **Data Summary Patterns**
- **Compact totals**: `fontFamily: monospace, fontWeight: bold, fontSize: 12px` in summary bars
- **Status indicators**: Color-coded text/backgrounds (`#28a745` success, `#ffc107` warning, `#dc3545` danger)
- **Metric displays**: Label + value pairs with consistent spacing and typography
- **Warning callouts**: Colored backgrounds with icons (🚨 ⚠️) and descriptive text

## Data Management & API Integration
- **Pagination**: Use `limit`/`offset` pattern (matching backend ListResponse)
- **Error Handling**: Consistent error boundary and API error handling
- **Loading States**: Show loading for async operations
- **Caching**: Simple in-memory caching for lookup data
- **API Structure**: Mirror backend patterns:
  - GET `/endpoint?limit=25&offset=0` for lists
  - POST `/endpoint` for creation
  - GET `/endpoint/{id}` for details
  - Standard response format: `{items: [], total: number, limit?: number, offset?: number}`

## Build Commands
- `npm start` - Development server
- `npm run build` - Production build  
- `npm test` - Run tests
- Proxy backend via: `http://localhost:8000` (already configured)

all db files are in the C:\Users\Dan\Dropbox\dev\dandytech\backend\db\migrations folder to not run migration files for me i will run them, referance these files if you need to see what the database looks like and scan thorugh them all so you can see the changes