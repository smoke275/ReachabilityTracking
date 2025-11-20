# Material Design 3 Integration Guide

## Overview
This application now uses **Material Web Components** (@material/web) for a modern, consistent Material Design 3 experience.

## Installed Components

### Currently Used Components
- `@material/web/button/filled-button.js` - Primary action buttons
- `@material/web/button/filled-tonal-button.js` - Secondary action buttons
- `@material/web/button/outlined-button.js` - Tertiary action buttons
- `@material/web/button/text-button.js` - Low-emphasis buttons
- `@material/web/icon/icon.js` - Material icons
- `@material/web/iconbutton/icon-button.js` - Icon-only buttons
- `@material/web/textfield/filled-text-field.js` - Text input fields
- `@material/web/slider/slider.js` - Range sliders
- `@material/web/divider/divider.js` - Visual dividers
- `@material/web/chips/chip-set.js` - Chip containers
- `@material/web/chips/filter-chip.js` - Selectable chips

## Material Design 3 Color System

### Color Tokens Used
```css
/* Primary Colors */
--md-sys-color-primary: #6750A4;
--md-sys-color-on-primary: #FFFFFF;
--md-sys-color-primary-container: #EADDFF;
--md-sys-color-on-primary-container: #21005D;

/* Secondary Colors */
--md-sys-color-secondary: #625B71;
--md-sys-color-on-secondary: #FFFFFF;
--md-sys-color-secondary-container: #E8DEF8;
--md-sys-color-on-secondary-container: #1D192B;

/* Surface Colors */
--md-sys-color-surface: #FEF7FF;
--md-sys-color-on-surface: #1D1B20;
--md-sys-color-surface-variant: #E7E0EC;
--md-sys-color-on-surface-variant: #49454F;
--md-sys-color-surface-container: #F3EDF7;
--md-sys-color-surface-container-high: #ECE6F0;
--md-sys-color-surface-container-highest: #E6E0E9;

/* Outline */
--md-sys-color-outline: #79747E;
--md-sys-color-outline-variant: #CAC4D0;

/* Error Colors */
--md-sys-color-error: #B3261E;
--md-sys-color-on-error: #FFFFFF;
--md-sys-color-error-container: #F9DEDC;
--md-sys-color-on-error-container: #410E0B;
```

## Using Material Web Components

### Buttons

#### Filled Button (Primary Actions)
```html
<md-filled-button>
    <md-icon slot="icon">edit</md-icon>
    Draw Polygon
</md-filled-button>
```

#### Filled Tonal Button (Secondary Actions)
```html
<md-filled-tonal-button>
    <md-icon slot="icon">save</md-icon>
    Save
</md-filled-tonal-button>
```

#### Outlined Button (Tertiary Actions)
```html
<md-outlined-button>
    <md-icon slot="icon">delete</md-icon>
    Delete
</md-outlined-button>
```

#### Text Button (Low Emphasis)
```html
<md-text-button>
    Cancel
</md-text-button>
```

### Icons

Material Web uses Material Icons from Google Fonts:
```html
<md-icon>polyline</md-icon>
<md-icon>edit</md-icon>
<md-icon>save</md-icon>
```

Or use Material Icons font directly:
```html
<span class="material-icons">polyline</span>
```

### Icon Buttons
```html
<md-icon-button>
    <md-icon>more_vert</md-icon>
</md-icon-button>
```

### Text Fields
```html
<md-filled-text-field 
    label="Polygon Name"
    value="">
</md-filled-text-field>
```

### Sliders
```html
<md-slider 
    min="0" 
    max="100" 
    value="50"
    labeled>
</md-slider>
```

## Customizing Material Web Components

### CSS Custom Properties

Material Web components can be customized using CSS custom properties:

```css
/* Button customization */
md-filled-button {
    --md-filled-button-container-color: var(--md-sys-color-primary);
    --md-filled-button-label-text-color: var(--md-sys-color-on-primary);
}

/* Text field customization */
md-filled-text-field {
    --md-filled-text-field-container-color: var(--md-sys-color-surface-container);
    --md-filled-text-field-label-text-color: var(--md-sys-color-on-surface-variant);
}
```

## Component Architecture

### Web Component Structure
Each component follows this pattern:

```javascript
export class MyComponent extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                }
                /* Component-specific styles using MD3 tokens */
            </style>
            
            <!-- Component HTML with Material Web components -->
        `;
    }

    setupEventListeners() {
        // Event handling with EventBus
    }
}

customElements.define('my-component', MyComponent);
```

## Best Practices

### 1. Use Material Design 3 Color Tokens
Always reference MD3 color tokens instead of hardcoded values:
```css
/* Good */
color: var(--md-sys-color-primary, #6750A4);

/* Bad */
color: #6750A4;
```

### 2. Button Hierarchy
- **Filled Button**: Primary action (one per screen)
- **Filled Tonal Button**: Important secondary actions
- **Outlined Button**: Medium-emphasis actions
- **Text Button**: Low-emphasis actions

### 3. Shadow DOM Styling
Components use Shadow DOM, so styles are encapsulated:
```javascript
this.shadowRoot.innerHTML = `
    <style>
        /* These styles only apply to this component */
    </style>
`;
```

### 4. Event Communication
Use the EventBus for component communication:
```javascript
import { eventBus } from '../utils/EventBus.js';

// Emit events
eventBus.emit('action:save');

// Listen to events
eventBus.on('polygon:added', () => this.update());
```

## Adding New Material Web Components

To add more Material Web components:

1. Install is already done: `npm install @material/web`

2. Import in `src/app.js`:
```javascript
import '@material/web/dialog/dialog.js';
import '@material/web/menu/menu.js';
import '@material/web/list/list.js';
```

3. Use in your component:
```html
<md-dialog>
    <span slot="headline">Confirmation</span>
    <form slot="content" method="dialog">
        Are you sure?
    </form>
    <div slot="actions">
        <md-text-button form="form">Cancel</md-text-button>
        <md-filled-button form="form">Confirm</md-filled-button>
    </div>
</md-dialog>
```

## Available Material Web Components

Check the full list at: https://material-web.dev/

Popular components:
- Buttons (filled, outlined, text, icon)
- Cards
- Checkboxes
- Chips
- Dialogs
- Dividers
- FABs (Floating Action Buttons)
- Lists
- Menus
- Progress indicators
- Radio buttons
- Select dropdowns
- Sliders
- Switches
- Tabs
- Text fields
- Tooltips

## Troubleshooting

### Icons Not Showing
Ensure Material Icons font is loaded in `styles.css`:
```css
@import url('https://fonts.googleapis.com/icon?family=Material+Icons');
```

### Component Not Rendering
1. Check if the component is imported in `app.js`
2. Ensure the custom element is registered
3. Check browser console for errors

### Styling Not Applied
1. Verify CSS custom properties are defined in `:root`
2. Check Shadow DOM encapsulation
3. Use browser DevTools to inspect styles

## Resources

- [Material Design 3](https://m3.material.io/)
- [Material Web Components](https://material-web.dev/)
- [Material Icons](https://fonts.google.com/icons)
- [MDN Web Components](https://developer.mozilla.org/en-US/docs/Web/Web_Components)
