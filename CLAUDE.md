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

### Form Controls
- **Select dropdowns**: Match button styling - `padding: 4px 6px, border: 1px solid #6c757d, borderRadius: 3px, fontSize: 10px, color: #6c757d, cursor: pointer`
- **Input fields**: `padding: 4px 8px, border: 1px solid #dee2e6, borderRadius: 3px, fontSize: 12px`
- **Focus states**: `borderColor: #007aff, boxShadow: 0 0 0 3px rgba(0, 122, 255, 0.15)`
- **Labels**: `fontSize: 12px, color: #6c757d, fontWeight: normal`

### Layout Patterns
- **Header sections**: `padding: 6px 12px, borderBottom: 1px solid #dee2e6, display: flex, justifyContent: space-between, alignItems: center`
- **Action groups**: `display: flex, gap: 8px, alignItems: center`
- **Content sections**: `padding: 12px, background: #fff, border: 1px solid #dee2e6, borderRadius: 4px`

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

## Data Display
- **Tables First**: Use data tables as primary display method
- **Comprehensive by default**: Show all relevant data upfront
- **Progressive filtering**: Add filters/search rather than hiding data
- **Inline editing**: Click-to-edit cells where appropriate
- **Keyboard navigation**: Arrow keys, Tab, Enter for spreadsheet-like navigation

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