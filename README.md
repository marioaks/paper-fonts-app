# Paper Fonts App

A React + TypeScript application that displays local font families using the Local Font Access API.

## Exercise Requirements Checklist

### Core Functionality
- [x] **Present a list of font families available on the user's computer**
  - [x] Uses Local Font Access API to fetch system fonts
  - [x] Displays list of available font families

- [x] **Show individual font styles associated with each font family**
  - [x] FontFamilyCard component displays all available styles for each family
  - [x] Each style is rendered using its actual font to show visual differences

- [x] **Two tabs: "All" and "Favorites"**
  - [x] NavBar component with tab switching functionality
  - [x] "All fonts" tab showing complete font list
  - [x] "Favorites" tab showing only favorited fonts

- [x] **Favoriting functionality**
  - [x] Heart icon button to add/remove fonts from favorites
  - [x] Double-click to favorite/unfavorite fonts
  - [x] Persistent favorites using localStorage
  - [x] Smooth animations for unfavorite transitions
  - [x] Favorited fonts appear in the Favorites tab

- [x] **Drag to reorder favorites (without external libraries)**
  - [x] Custom drag-and-drop implementation
  - [x] Reorder functionality works in both tabs
  - [x] Persistent reordering using localStorage
  - [x] Visual feedback during drag operations

### UI/UX Features
- [x] **Performance considerations**
  - [x] Memoized components to prevent unnecessary re-renders
  - [x] Debounced favorite actions
  - [x] Efficient drag and drop

- [x] **Error handling**
  - [x] Browser compatibility checks
  - [x] Permission denied states
  - [x] Loading states
  - [x] Error recovery options

### Additional Features Implemented
- [x] **Font size toggle**
  - [x] FontSizeToggleGroup component for adjusting preview text size

- [x] **Smooth animations**
  - [x] Favorite/unfavorite transitions
  - [x] Drag and drop visual feedback

## Known Issues / TODOs

### Bug Fixes
- [ ] **Fix hover styles bug after drag and drop**
  - Issue: Wrong element retains hover styles after dragging and dropping
  - Need to properly clean up hover states during drag operations

### Performance Improvements
- [ ] **Implement virtualization for font lists**
  - Large font lists can impact performance
  - Implement virtual scrolling for better performance with 1000+ fonts
  - Note: Current drag-and-drop implementation would need refactoring to work with virtualization

### Future Enhancements
- [ ] **Search and filtering functionality**
  - Add search input to filter fonts by name
  - Category filtering (serif, sans-serif, monospace, etc.)

- [ ] **Font preview improvements**
  - Custom preview text input
  - Multiple preview sizes simultaneously
  - Export font samples

- [ ] **Enhanced drag and drop**
  - Visual placeholders during drag
  - Drag between All and Favorites tabs
  - Multi-select drag operations

## Development

### Setup
```bash
bun install
bun run dev
```

### Browser Requirements
- Chrome 103+ (Local Font Access API support)
- Enable "Experimental Web Platform features" flag if needed

### Architecture
- **Components**: Modular React components with CSS modules
- **Hooks**: Custom hooks for state management and side effects
- **State**: useReducer for complex state, localStorage for persistence
- **Types**: Comprehensive TypeScript definitions

---

**Time spent:** ~8 hours  
**Technologies:** React, TypeScript, Vite, Local Font Access API
