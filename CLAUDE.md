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