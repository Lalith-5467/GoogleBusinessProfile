# Design System: UI Components & Conventions

## Core Component Patterns

### 1. Surface Cards (`.design-card`, `.glass-card`)
- Clean white background (`#FFFFFF`) with subtle 1px border (`#DDE5DE`).
- Soft multi-layered elevation shadow (`0 1px 3px rgba(29, 30, 24, 0.04)`).
- Rounded border radius: `16px`.

### 2. Action Buttons
- **Primary**: Solid olive (`#6B8F71`) with white text and smooth transitions.
- **Secondary / Ghost**: White or transparent background with `#DDE5DE` border and `#68736B` text.
- **Danger / Delete**: Soft red hover with confirmation prompts.

### 3. Status Badges & Indicators
- Live status pills with animated pulsing indicators (`animate-pulse`).
- Connected state: Green badge (`#EAF4EE` background, `#2F7D4A` text).
- Disconnected state: Amber or grey badge.

### 4. Interactive Data Tables
- Sticky header with subtle border.
- Hover highlight on rows (`hover:bg-[#F6F8F5]/80`).
- Responsive pagination controls (first, previous, next, last).
- Column sorting and quick filtering.

### 5. Detail Modals (`.design-panel`)
- Centered backdrop overlay with blur (`backdrop-blur-sm`).
- Modal border radius: `20px`.
- Tabbed or sectioned attributes inspection for comprehensive business profiles.
