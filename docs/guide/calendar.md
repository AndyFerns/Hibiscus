# Calendar & Daily Planner

Hibiscus includes a fully-featured calendar system for scheduling study sessions, tracking deadlines, and managing your daily tasks. The calendar is integrated into the **Right Panel** and provides both a monthly overview and a focused daily planning view.

---

## Calendar View

**Shortcut**: `Ctrl+J` (toggles right panel), then select Calendar tab

### Monthly Calendar Display

The calendar provides a traditional month-view layout with:

- **Navigation Controls**: Previous/Next month buttons with smooth transitions
- **Current Day Highlighting**: Distinct visual indicator for today
- **Event Indicators**: Dots beneath dates showing scheduled events
- **Task Badges**: Visual indicators for days with pending tasks
- **Selected State**: Clear highlighting for the active date

### View Modes

Switch between calendar views using the view selector:

- **Month View**: Traditional grid showing full month
- **Week View**: Focused 7-day horizontal layout (planned)
- **Day View**: Single day detail with hourly breakdown (planned)

---

## Events System

### Creating Events

**Method 1**: Click any date in the calendar → "Add Event" button
**Method 2**: Click the "+ Event" button in the right panel header

The Event Modal provides:

- **Title**: Event name/description
- **Date**: Selected automatically from calendar click
- **Time Range**: Optional start/end times
- **All Day Toggle**: For day-long events
- **Linked File**: Attach a workspace file to the event
- **Color Coding**: Choose from preset colors for visual organization
- **Description**: Additional notes (markdown supported)

### Event Types

Hibiscus supports several built-in event categories:

| Color | Purpose |
|-------|---------|
| Blue | Study sessions, classes |
| Green | Completed tasks, achievements |
| Yellow | Deadlines, important dates |
| Red | Urgent items, exams |
| Purple | Personal notes, misc |

### Recurring Events

Set up repeating study sessions:

- **Daily**: For habits and streak maintenance
- **Weekly**: For regular classes or study groups
- **Monthly**: For reviews or milestone checks
- **Custom**: Specific days of the week

### Event Modal Interface

```
┌─────────────────────────────────┐
│  Event Details                  │
├─────────────────────────────────┤
│  Title: [________________]      │
│  Date:  [📅 MM/DD/YYYY]        │
│  Time:  [🕐 09:00] - [🕐 10:00] │
│  ☑ All day                      │
│  Color: [🔵][🟢][🟡][🔴][🟣]   │
│  Link File: [Select... ▼]      │
│  Description:                   │
│  ┌─────────────────────────┐   │
│  │                         │   │
│  │  [markdown supported]   │   │
│  └─────────────────────────┘   │
│  [Cancel]        [Save Event] │
└─────────────────────────────────┘
```

---

## Task Management

### Daily Tasks

Each day has an associated task list that appears in the **Daily Planner** section:

- **Quick Add**: Type and press Enter to create tasks
- **Checkbox Toggle**: Click to mark complete/incomplete
- **Task Reordering**: Drag to prioritize (planned)
- **Due Time**: Optional time assignment for deadlines

### Task States

- **Active**: Pending tasks shown in default color
- **Completed**: Strikethrough with reduced opacity
- **Overdue**: Past-due tasks highlighted in warning color
- **Recurring**: Repeating tasks marked with special icon

### Task List Interface

```
Daily Planner - Monday, Jan 15
─────────────────────────────────
☐ Review flashcards (Due: 10:00)
☑ Read chapter 3
☐ Complete problem set
☐ [Add new task...       ]
```

---

## Daily Planner Section

The **PlannerSection** provides a focused view of today's schedule:

### Components

1. **Date Header**: Current date with navigation arrows
2. **Quick Stats**: Task completion count
3. **Task List**: Interactive checkbox items
4. **Mini Calendar**: Simplified month view for quick jumps
5. **Upcoming Events**: Next 3 scheduled items

### Integration with Study Tools

The planner connects to other Hibiscus features:

- **Pomodoro Link**: Start a timed session from any task
- **File Attachments**: Open linked files directly
- **Flashcard Decks**: Associate review decks with tasks
- **Knowledge Graph**: Visualize task connections

---

## Data Persistence

Calendar data is stored in `.hibiscus/calendar.json`:

```json
{
  "events": [
    {
      "id": "uuid",
      "title": "Study Session",
      "date": "2024-01-15",
      "startTime": "09:00",
      "endTime": "10:30",
      "allDay": false,
      "color": "blue",
      "linkedFile": "notes/math.md",
      "description": "Focus on calculus"
    }
  ],
  "tasks": [
    {
      "id": "uuid",
      "title": "Review flashcards",
      "date": "2024-01-15",
      "completed": false,
      "dueTime": "10:00"
    }
  ],
  "settings": {
    "view": "month",
    "startOfWeek": "monday",
    "defaultEventColor": "blue"
  }
}
```

**Features:**
- Atomic writes prevent data corruption
- Automatic backups before modifications
- Schema migration on load (backward compatible)
- Real-time synchronization with file watcher

---

## Keyboard Navigation

| Shortcut | Action |
|----------|--------|
| `← / →` | Navigate previous/next day |
| `↑ / ↓` | Navigate weeks (month view) |
| `Enter` | Open selected date's events |
| `Delete` | Remove selected event |
| `N` | Create new event (when calendar focused) |
| `T` | Toggle task view (when calendar focused) |

---

## Tips for Effective Planning

### Study Scheduling

- **Block Time**: Use all-day events for study blocks
- **Pomodoro Integration**: Link tasks to timed sessions
- **Buffer Time**: Add 15-min buffers between intensive sessions
- **Review Slots**: Schedule weekly review sessions

### Task Management

- **Morning Planning**: Start each day by reviewing tasks
- **Priority Order**: List tasks by importance, not urgency
- **Realistic Goals**: Limit to 3-5 main tasks per day
- **Weekly Reviews**: Use calendar to plan the week ahead

### Workflow Integration

1. **Create Event** → Set study time
2. **Link File** → Attach relevant notes
3. **Add Tasks** → Break down what to cover
4. **Start Pomodoro** → Begin focused work
5. **Check Off Tasks** → Track completion
6. **Review Stats** → See progress over time

---

## Screenshots

*[PHOTO PLACEHOLDER: Calendar Month View]*
*Add screenshot showing the calendar month view with events marked on various dates*

*[PHOTO PLACEHOLDER: Event Modal]*
*Add screenshot showing the event creation modal with all fields visible*

*[PHOTO PLACEHOLDER: Daily Planner Section]*
*Add screenshot showing the daily planner with task list*

---

## Troubleshooting

### Events Not Saving

- Verify `.hibiscus/calendar.json` exists and is writable
- Check for JSON syntax errors in the file
- Try restarting Hibiscus to reload from disk

### Calendar Not Updating

- The calendar auto-refreshes when file changes detected
- Force refresh by closing/reopening right panel (`Ctrl+J` twice)

### Linked Files Not Opening

- Ensure the file path is relative to workspace root
- Verify the file exists in the workspace
- Check file permissions

### Tasks Disappeared

- Tasks are date-specific; check you're viewing the correct date
- Tasks are stored by date in calendar.json
- Check backup folder for previous versions

---

## API Commands

The calendar system exposes these backend commands:

| Command | Description |
|---------|-------------|
| `read_calendar_data` | Load all calendar events and tasks |
| `save_calendar_data` | Persist calendar modifications |

See [API Reference](../dev/api-reference.md) for detailed signatures.
