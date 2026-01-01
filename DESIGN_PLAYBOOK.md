# Cenpact Design Web Guide.
### Cencori Design System.

> **Cenpact** = Cencori + Compact. A design philosophy prioritizing information density, subtle elegance, and developer-focused UX.

---

## Core Principles

| Principle | Description |
|-----------|-------------|
| **Dense but Breathable** | Pack information tightly while maintaining visual hierarchy through whitespace |
| **Subtle Sophistication** | Prefer muted colors, soft borders, and understated hover effects |
| **Developer-First** | Design for power users who value efficiency over hand-holding |
| **Dark Mode Native** | Design in dark mode first, adapt for light |

---

## Typography Scale

### Dashboard (Dense)
```
text-[10px]  → Labels, metadata, timestamps
text-xs     → Body text, feature lists, descriptions
text-sm     → Section labels, form labels
text-base   → Rarely used in dashboard
text-lg     → Page titles (h1)
text-xl     → Hero titles only
```

### Landing Pages (Expressive)
```
text-xs     → Badges, small labels
text-sm     → Body copy, subtitles
text-base   → Descriptions
text-xl     → Section titles
text-2xl    → Hero subheadings
text-3xl+   → Hero headlines
```

### Font Weights
- `font-medium` → Labels, navigation
- `font-semibold` → Headings, emphasis
- `font-bold` → Hero headlines only

---

## Spacing System

### Page Containers
```tsx
// Dashboard pages
className="max-w-5xl mx-auto px-6 py-8"

// Landing sections
className="max-w-6xl mx-auto px-4 md:px-6"
```

### Component Spacing
| Element | Padding | Gap |
|---------|---------|-----|
| Cards | `p-4` to `p-5` | — |
| Buttons (sm) | `h-7 px-2.5` or `h-8 px-3` | `gap-1.5` |
| Buttons (default) | `h-9 px-4` | `gap-2` |
| Form rows | `px-4 py-3` | — |
| Section margins | — | `space-y-6` |

### Vertical Rhythm
- Use `space-y-3` within sections
- Use `space-y-6` between sections
- Use `mb-2` to `mb-4` for headings

---

## Color System

### Semantic Colors
| Purpose | Light Mode | Dark Mode |
|---------|------------|-----------|
| **Foreground** | `hsl(0 0% 9%)` | `hsl(0 0% 98%)` |
| **Background** | `hsl(0 0% 100%)` | `hsl(0 0% 5%)` |
| **Muted** | `hsl(0 0% 96%)` | `hsl(0 0% 12%)` |
| **Border** | `hsl(0 0% 90%)` | `hsl(0 0% 15%)` |
| **Card** | `hsl(0 0% 100%)` | `hsl(0 0% 8%)` |

### Accent Colors
| Color | Usage | Tailwind Class |
|-------|-------|----------------|
| **Emerald** | Success, connected, active | `text-emerald-500`, `bg-emerald-500` |
| **Amber** | Warning, pending, soon | `text-amber-500`, `bg-amber-500` |
| **Red** | Error, destructive, danger | `text-red-500`, `bg-red-500` |
| **Blue** | Info, links (rare) | `text-blue-500` |

### Opacity Patterns
```tsx
// Borders
border-border       // Full opacity
border-border/50    // Soft (common)
border-border/40    // Subtle

// Backgrounds
bg-muted            // Full
bg-muted/50         // Hover states
bg-muted/30         // Very subtle
```

---

## Component Patterns

### Buttons
```tsx
// Primary (rounded-full for CTAs)
<Button className="h-9 px-4 text-sm rounded-full">
  Get Started
</Button>

// Secondary (outline)
<Button variant="outline" className="h-8 px-3 text-xs rounded-full">
  View Docs
</Button>

// Ghost (subtle actions)
<Button variant="ghost" size="sm" className="h-7 text-xs">
  Cancel
</Button>
```

### Cards
```tsx
// Standard card
<div className="rounded-xl border border-border/50 bg-card p-5">
  {children}
</div>

// Highlighted card (badge only, no color inversion)
<div className="relative rounded-xl border border-border bg-card p-5 shadow-lg">
  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
    Popular
  </Badge>
  {children}
</div>
```

### Badges
```tsx
// Outline (default)
<Badge variant="outline" className="rounded-full px-3 py-0.5 text-[10px]">
  Beta
</Badge>

// Colored status
<Badge className="rounded-full px-2 py-0.5 text-[10px] bg-emerald-500/10 text-emerald-500 border-0">
  Connected
</Badge>
```

### Form Rows
```tsx
<div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
  <div className="space-y-0.5">
    <p className="text-xs font-medium">Label</p>
    <p className="text-[10px] text-muted-foreground">Description</p>
  </div>
  <Input className="w-64 h-8 text-sm" />
</div>
```

### Tabs (Mobile-Responsive)
```tsx
// TabsTrigger must have whitespace-nowrap to prevent text wrapping on mobile
// Component: components/ui/tabs.tsx
<TabsTrigger
  className={cn(
    "px-3 md:px-4 py-3 text-xs md:text-sm font-medium",
    "whitespace-nowrap shrink-0",  // Critical for mobile!
    "text-muted-foreground hover:text-foreground",
    "data-[state=active]:text-foreground"
  )}
>

// TabsList should scroll horizontally on mobile
<TabsList className="flex w-full flex-nowrap overflow-x-auto">
```

### Settings Form Rows (Mobile-Responsive)
```tsx
// Stacks vertically on mobile, horizontal on desktop
<div className="flex flex-col md:flex-row md:items-center md:justify-between px-4 py-3 border-b border-border/40 gap-2 md:gap-0">
  <div className="space-y-0.5">
    <p className="text-sm md:text-xs font-medium">Label</p>
    <p className="text-xs md:text-[10px] text-muted-foreground">Description</p>
  </div>
  <Input className="w-full md:w-64 h-10 md:h-8 text-sm md:text-xs" />
</div>

// For badges/read-only values
<div className="flex flex-col md:flex-row md:items-center md:justify-between px-4 py-3 gap-2 md:gap-0">
  <div className="space-y-0.5">
    <p className="text-sm md:text-xs font-medium">Project ID</p>
    <p className="text-xs md:text-[10px] text-muted-foreground">Reference used in APIs.</p>
  </div>
  <div className="flex items-center gap-2">
    <span className="px-3 py-1.5 md:py-1 bg-muted/50 rounded-md font-mono text-sm md:text-xs">
      {value}
    </span>
    <Button variant="outline" size="sm" className="h-8 md:h-7 text-xs gap-1.5">
      <Copy className="h-3 w-3" />
      Copy
    </Button>
  </div>
</div>

// Save button row
<div className="flex justify-end px-4 py-2.5 md:py-2 bg-muted/20">
  <Button size="sm" className="h-9 md:h-7 px-4 md:px-3 text-sm md:text-xs">
    Save changes
  </Button>
</div>
```

---

## Page Layouts

### Dashboard Page Template
```tsx
<div className="w-full max-w-5xl mx-auto px-6 py-8 space-y-6">
  {/* Header */}
  <div>
    <h1 className="text-xl font-semibold">Page Title</h1>
    <p className="text-sm text-muted-foreground">Description</p>
  </div>

  {/* Content */}
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    {cards}
  </div>
</div>
```

### Landing Section Template
```tsx
<section className="py-20 px-4">
  <div className="max-w-6xl mx-auto">
    <div className="text-center mb-12">
      <Badge>Label</Badge>
      <h2 className="text-2xl md:text-4xl font-bold mt-4">
        Section Title
      </h2>
      <p className="text-muted-foreground max-w-md mx-auto mt-4">
        Description text
      </p>
    </div>
    {/* Content */}
  </div>
</section>
```

---

## Iconography

### Icon Sources
1. **Lucide React** → UI icons (primary)
2. **@lobehub/icons** → Brand logos (AI providers, platforms)
3. **@heroicons/react** → Occasional alternatives

### Icon Sizing
| Context | Size |
|---------|------|
| Buttons | `h-3 w-3` to `h-4 w-4` |
| Cards | `h-5 w-5` |
| Feature icons | `h-6 w-6` to `h-8 w-8` |

### Brand Icons with Colors
```tsx
// Use .Color variant for brand colors
import { Cloudflare, Aws, Azure, Google } from "@lobehub/icons";

<Cloudflare.Color size={20} />
<Aws.Color size={20} />
<Azure.Color size={20} />
<Google.Color size={20} />
```

---

## Animation Guidelines

### Hover Effects
```tsx
// Cards
className="transition-all hover:border-border hover:shadow-lg"

// Buttons with icons
className="group"
<ArrowRight className="transition-transform group-hover:translate-x-0.5" />

// Scale on hover (rare, for emphasis)
className="transition-transform hover:scale-105"
```

### Preferred Transitions
- `transition-colors` → Color changes
- `transition-all duration-300` → Multi-property changes
- Avoid: jarring transforms, long durations

---

## Do's and Don'ts

### ✅ Do
- Use `rounded-xl` or `rounded-2xl` for cards
- Use `rounded-full` for buttons and badges
- Use `border-border/50` for subtle separation
- Use `text-muted-foreground` for secondary text
- Use emerald as primary accent color

### ❌ Don't
- Invert card colors for highlighting (use badges instead)
- Use pure black/white (use foreground/background tokens)
- Use animations longer than 300ms
- Use more than 3 levels of text hierarchy per section
- Use placeholder images (generate or use real assets)

---

## Quick Reference

### Standard Classes
```tsx
// Page container
"max-w-5xl mx-auto px-6 py-8"

// Card
"rounded-xl border border-border/50 bg-card p-5"

// Button CTA
"h-9 px-4 text-sm rounded-full"

// Small text
"text-xs text-muted-foreground"

// Label
"text-[10px] font-medium"

// Section gap
"space-y-6"
---

## Responsive Breakpoints

### Tailwind Breakpoints
```
sm:   640px   → Mobile landscape
md:   768px   → Tablet
lg:   1024px  → Desktop
xl:   1280px  → Large desktop
2xl:  1536px  → Extra large
```

### Common Patterns
```tsx
// Grid columns
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"

// Padding adjustments
className="px-4 md:px-6"

// Text scaling
className="text-2xl md:text-4xl"

// Hide/show elements
className="hidden md:block"    // Desktop only
className="md:hidden"          // Mobile only
```

### Breakpoint Philosophy
- **Mobile-first**: Start with mobile styles, add breakpoints for larger screens
- **Content-aware**: Use breakpoints based on content, not device sizes
- **Minimal jumps**: Prefer 2-3 breakpoint variants max

---

## Loading States

### Skeleton Patterns
```tsx
// Text skeleton
<Skeleton className="h-4 w-32" />

// Card skeleton
<Skeleton className="h-48 w-full rounded-xl" />

// Avatar skeleton
<Skeleton className="h-8 w-8 rounded-full" />

// Table row skeleton
<div className="flex items-center gap-4">
  <Skeleton className="h-3 w-20" />
  <Skeleton className="h-3 w-32" />
  <Skeleton className="h-3 w-16" />
</div>
```

### Full Page Loading
```tsx
<div className="w-full max-w-5xl mx-auto px-6 py-8 space-y-6">
  <Skeleton className="h-6 w-32" />
  <Skeleton className="h-4 w-48" />
  <div className="grid grid-cols-3 gap-4">
    {[1, 2, 3].map((i) => (
      <Skeleton key={i} className="h-32 rounded-xl" />
    ))}
  </div>
</div>
```

### Inline Loading
```tsx
// Button loading
<Button disabled>
  <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
  Saving...
</Button>

// Refresh icon
<RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
```

---

## Empty States

### Standard Empty State
```tsx
<div className="text-center py-12">
  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
    <Inbox className="h-6 w-6 text-muted-foreground" />
  </div>
  <h3 className="text-sm font-medium mb-1">No items yet</h3>
  <p className="text-xs text-muted-foreground mb-4">
    Get started by creating your first item.
  </p>
  <Button size="sm" className="h-8 text-xs rounded-full">
    <Plus className="h-3 w-3 mr-1.5" />
    Create Item
  </Button>
</div>
```

### Compact Empty State
```tsx
<div className="px-4 py-6 text-center">
  <p className="text-xs text-muted-foreground">No data available</p>
</div>
```

### Error State
```tsx
<div className="text-center py-12">
  <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-3" />
  <h3 className="text-sm font-medium mb-1">Something went wrong</h3>
  <p className="text-xs text-muted-foreground mb-4">
    {error.message}
  </p>
  <Button variant="outline" size="sm" onClick={retry}>
    Try Again
  </Button>
</div>
```

---

## Form Validation

### Input States
```tsx
// Default
<Input className="h-8 text-sm" />

// Error state
<Input className="h-8 text-sm border-red-500 focus-visible:ring-red-500" />

// With error message
<div className="space-y-1">
  <Input className="h-8 text-sm border-red-500" />
  <p className="text-[10px] text-red-500">This field is required</p>
</div>
```

### Validation Message Styling
```tsx
// Error
<p className="text-[10px] text-red-500">Error message</p>

// Success
<p className="text-[10px] text-emerald-500">Looks good!</p>

// Hint (always visible)
<p className="text-[10px] text-muted-foreground">Must be at least 8 characters</p>
```

### Form Layout
```tsx
<form className="space-y-4">
  <div className="space-y-1.5">
    <Label className="text-xs">Field Name</Label>
    <Input className="h-8 text-sm" />
    <p className="text-[10px] text-muted-foreground">Help text</p>
  </div>
  
  <div className="flex justify-end gap-2 pt-2">
    <Button variant="ghost" size="sm">Cancel</Button>
    <Button size="sm">Save</Button>
  </div>
</form>
```

---

## Toasts & Notifications

### Using Sonner
```tsx
import { toast } from "sonner";

// Success
toast.success("Changes saved successfully");

// Error
toast.error("Failed to save changes");

// Info
toast.info("Feature coming soon!");

// With description
toast.success("Project created", {
  description: "Your new project is ready to use"
});

// With action
toast("File uploaded", {
  action: {
    label: "View",
    onClick: () => router.push("/files")
  }
});
```

### Toast Guidelines
- Keep messages under 60 characters
- Use sentence case
- Success: Confirm action completed
- Error: Explain what went wrong
- Info: Non-critical updates

---

## Modal & Dialog Patterns

### Standard Dialog
```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button size="sm">Open Dialog</Button>
  </DialogTrigger>
  <DialogContent className="max-w-sm">
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription className="text-xs">
        Brief description of what this dialog does.
      </DialogDescription>
    </DialogHeader>
    
    {/* Content */}
    <div className="space-y-3">
      {children}
    </div>
    
    <DialogFooter>
      <Button variant="ghost" size="sm">Cancel</Button>
      <Button size="sm">Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Dialog Sizes
| Size | Class | Use Case |
|------|-------|----------|
| Small | `max-w-sm` | Confirmations, simple forms |
| Medium | `max-w-md` | Standard forms |
| Large | `max-w-lg` | Complex forms, previews |

### Destructive Dialog
```tsx
<DialogContent className="max-w-sm">
  <DialogHeader>
    <DialogTitle>Delete Project</DialogTitle>
    <DialogDescription className="text-xs">
      Type <span className="font-mono font-medium">{name}</span> to confirm.
    </DialogDescription>
  </DialogHeader>
  <Input placeholder={name} className="h-9" />
  <DialogFooter>
    <Button variant="ghost" size="sm">Cancel</Button>
    <Button variant="destructive" size="sm" disabled={!isConfirmed}>
      Delete
    </Button>
  </DialogFooter>
</DialogContent>
```

---

## Table Styling

### Compact Data Table
```tsx
<div className="rounded-lg border border-border/60 bg-card overflow-hidden">
  <div className="divide-y divide-border/40">
    {/* Header */}
    <div className="flex px-4 py-2 bg-muted/30">
      <span className="text-[10px] font-medium text-muted-foreground w-32">Name</span>
      <span className="text-[10px] font-medium text-muted-foreground flex-1">Value</span>
      <span className="text-[10px] font-medium text-muted-foreground w-20">Status</span>
    </div>
    
    {/* Rows */}
    {items.map((item) => (
      <div key={item.id} className="flex items-center px-4 py-2 hover:bg-muted/30">
        <span className="text-xs w-32 truncate">{item.name}</span>
        <span className="text-xs text-muted-foreground flex-1">{item.value}</span>
        <span className="text-xs w-20">{item.status}</span>
      </div>
    ))}
  </div>
</div>
```

### Key-Value Display
```tsx
<div className="divide-y divide-border/40">
  <div className="flex justify-between px-4 py-2">
    <span className="text-[10px] text-muted-foreground">Label</span>
    <span className="text-[10px] font-mono">{value}</span>
  </div>
</div>
```

---

## Accessibility

### Focus States
```tsx
// Default focus ring (from Tailwind)
focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2

// Custom focus for dark backgrounds
focus-visible:ring-2 focus-visible:ring-white/20
```

### Keyboard Navigation
- All interactive elements must be focusable
- Use `tabIndex={0}` only when necessary
- Provide visible focus indicators
- Support Escape to close modals

### ARIA Patterns
```tsx
// Icon-only buttons need labels
<Button size="icon" aria-label="Close">
  <X className="h-4 w-4" />
</Button>

// Loading states
<Button disabled aria-busy="true">
  <Loader2 className="animate-spin" aria-hidden="true" />
  Loading
</Button>

// Status indicators
<span className="w-2 h-2 rounded-full bg-emerald-500" aria-label="Active" />
```

### Color Contrast
- Text on backgrounds: minimum 4.5:1 contrast ratio
- Large text (18px+): minimum 3:1
- Use `text-muted-foreground` sparingly on dark backgrounds

---

## Dark/Light Mode

### Theme Tokens
Always use semantic tokens instead of raw colors:
```tsx
// ✅ Good - adapts to theme
className="bg-background text-foreground"
className="border-border bg-card"
className="text-muted-foreground"

// ❌ Bad - doesn't adapt
className="bg-white text-black"
className="border-gray-200"
```

### Theme-Aware Components
```tsx
// Conditional classes (rare, when tokens aren't enough)
import { useTheme } from "next-themes";

const { theme } = useTheme();
const iconColor = theme === 'dark' ? '#ffffff' : '#000000';
```

### Testing Themes
- Always test both themes before shipping
- Check contrast ratios in both modes
- Verify hover states are visible in both

---

## File & Naming Conventions

### File Structure
```
components/
├── ui/              # shadcn/ui primitives
├── landing/         # Landing page components
├── dashboard/       # Dashboard-specific components
├── icons/           # Custom icon components
└── [feature]/       # Feature-specific components

app/
├── (marketing)/     # Marketing pages
├── (products)/      # Product pages
├── dashboard/       # Dashboard routes
└── api/            # API routes
```

### Naming Patterns
| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `IntegrationCard.tsx` |
| Hooks | camelCase with `use` prefix | `useProjectDetails.ts` |
| Utils | camelCase | `formatDate.ts` |
| Pages | `page.tsx` (Next.js) | `app/dashboard/page.tsx` |
| API Routes | `route.ts` | `app/api/projects/route.ts` |

### Component File Structure
```tsx
// imports
import { ... } from "...";

// types
interface ComponentProps { ... }

// component
export function Component({ ...props }: ComponentProps) {
  // hooks
  // state
  // handlers
  // early returns (loading, error)
  // main render
}

// sub-components (if small)
function SubComponent() { ... }
```

---

## Real Examples

### Reference Components
| Pattern | File Location |
|---------|---------------|
| Integration Cards | `app/dashboard/.../edge/page.tsx` |
| Settings Form | `app/dashboard/.../settings/page.tsx` |
| Pricing Section | `components/landing/Pricing.tsx` |
| Feature Cards | `components/landing/Features.tsx` |
| Brand Icons | `components/icons/BrandIcons.tsx` |

---

## Shadow Scale

### Shadow Levels
| Level | Class | Use Case |
|-------|-------|----------|
| None | `shadow-none` | Flat elements |
| Subtle | `shadow-sm` | Cards on hover, buttons |
| Default | `shadow` | Elevated cards |
| Medium | `shadow-md` | Dropdowns, popovers |
| Large | `shadow-lg` | Modals, dialogs |
| Extra Large | `shadow-xl` | Hero elements, featured cards |

### Usage Patterns
```tsx
// Card with hover shadow
className="shadow-none hover:shadow-lg transition-shadow"

// Modal/Dialog
className="shadow-xl"

// Dropdown
className="shadow-md"

// Highlighted pricing card
className="shadow-lg"
```

### Shadow Guidelines
- Prefer `shadow-none` by default
- Add shadows on interaction (hover)
- Use `shadow-lg` for highlighted/featured elements
- Avoid mixing shadow levels in same component group

---

## Border Radius Scale

### Radius Levels
| Level | Class | Use Case |
|-------|-------|----------|
| None | `rounded-none` | Tables, dividers |
| Small | `rounded-sm` | Inline elements |
| Default | `rounded` | Subtle rounding |
| Medium | `rounded-md` | Form inputs |
| Large | `rounded-lg` | Settings cards, form groups |
| Extra Large | `rounded-xl` | Standard cards |
| 2XL | `rounded-2xl` | Feature cards, hero elements |
| Full | `rounded-full` | Buttons, badges, avatars |

### Standard Pairings
```tsx
// Buttons & Badges → Always full
className="rounded-full"

// Cards → xl or 2xl
className="rounded-xl"  // Dashboard cards
className="rounded-2xl" // Landing page cards

// Inputs → md or lg
className="rounded-md"  // Default inputs
className="rounded-lg"  // Larger inputs

// Icons/Avatars → full or lg
className="rounded-full" // Avatar
className="rounded-lg"   // Icon container
```

---

## Z-Index Scale

### Layer Hierarchy
| Layer | Z-Index | Use Case |
|-------|---------|----------|
| Base | `z-0` | Default content |
| Raised | `z-10` | Sticky elements, floating items |
| Dropdown | `z-20` | Dropdown menus |
| Sticky | `z-30` | Sticky headers |
| Overlay | `z-40` | Sheet overlays |
| Modal | `z-50` | Modals, dialogs |
| Popover | `z-[60]` | Tooltips on modals |
| Toast | `z-[100]` | Toast notifications |

### Usage Example
```tsx
// Sticky navbar
className="sticky top-0 z-30"

// Modal overlay
className="fixed inset-0 z-40 bg-black/50"

// Modal content
className="fixed z-50"

// Toast container (handled by Sonner)
// Automatically uses high z-index
```

---

## Motion Library

### Framer Motion Basics
```tsx
import { motion } from "framer-motion";

// Fade in
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.3 }}
>
  {content}
</motion.div>

// Slide up
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
  {content}
</motion.div>
```

### Staggered Children
```tsx
// Container
<motion.div
  initial="hidden"
  animate="visible"
  variants={{
    visible: { transition: { staggerChildren: 0.1 } }
  }}
>
  {items.map((item) => (
    <motion.div
      key={item.id}
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
      }}
    >
      {item.content}
    </motion.div>
  ))}
</motion.div>
```

### Animation Guidelines
- Keep durations short: `0.2s` to `0.4s`
- Use easing: `ease-out` for entrances, `ease-in` for exits
- Prefer opacity + transform over layout shifts
- Disable animations for `prefers-reduced-motion`

---

## Performance Tips

### Image Optimization
```tsx
// Use Next.js Image component
import Image from "next/image";

<Image
  src="/path/to/image.webp"
  alt="Description"
  width={400}
  height={300}
  loading="lazy"
  placeholder="blur"
/>

// Use WebP format when possible
// Compress images before committing
```

### Code Splitting
```tsx
// Lazy load heavy components
import dynamic from "next/dynamic";

const HeavyChart = dynamic(() => import("./HeavyChart"), {
  loading: () => <Skeleton className="h-64" />,
  ssr: false
});
```

### Bundle Optimization
- Import icons individually:
  ```tsx
  // ✅ Good
  import { Check,  ArrowRight } from "lucide-react";
  
  // ❌ Bad - imports entire library
  import * as Icons from "lucide-react";
  ```

### React Query Best Practices
- Use appropriate `staleTime` (see Cache Strategy table)
- Prefetch on hover for navigation
- Use `enabled` flag for dependent queries
- Invalidate cache after mutations

---

## Design Review Checklist

### Pre-Ship Checklist

#### Visual Quality
- [ ] Tested in both dark and light modes
- [ ] Responsive at all breakpoints (mobile, tablet, desktop)
- [ ] Consistent spacing (follows `space-y-*` system)
- [ ] Typography follows scale (no ad-hoc sizes)
- [ ] Colors use semantic tokens

#### Interaction
- [ ] All interactive elements have hover states
- [ ] Focus states are visible
- [ ] Loading states implemented
- [ ] Empty states designed
- [ ] Error states handled gracefully

#### Accessibility
- [ ] Keyboard navigable
- [ ] Color contrast passes WCAG AA (4.5:1)
- [ ] Icon-only buttons have `aria-label`
- [ ] Form inputs have labels

#### Performance
- [ ] Images optimized (WebP, compressed)
- [ ] No layout shift on load
- [ ] Heavy components lazy loaded
- [ ] No unnecessary re-renders

#### Code Quality
- [ ] Follows component structure pattern
- [ ] Uses React Query for data fetching
- [ ] No inline styles (use Tailwind)
- [ ] No magic numbers (use design tokens)

---

*Last updated: December 2025*
*Version: 1.2*
