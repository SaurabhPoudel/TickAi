# Design system

## Idea

The interface follows the sky. It is bright and crisp through the day, shifts to dusk as bedtime approaches, and turns fully to night for the check-in. The sky header is the one bold element; everything else stays quiet.

- **Stars:** each task you finish today adds a star to the header.
- **Moon:** your streak. It fills over seven nights; a full moon saves a grace night.
- **Night mode is earned by time, not a setting:** within 30 minutes of bedtime, the whole app goes dark.

## Color

| Token | Hex | Use |
|---|---|---|
| Midnight ink | `#121436` | Night background |
| Nightfall | `#1E2154` | Night surfaces |
| Moonglow | `#F3DE8A` | Moon, night primary actions |
| Sea glass | `#7BE0C3` | Done, at night |
| Ember | `#FFB36B` | Carried over, at night |
| Daybreak | `#EEF1FF` | Day background |
| Ultraviolet | `#4636E3` | Day primary actions |
| Ink | `#141538` | Day text |

## Type

Bricolage Grotesque throughout, in four weights. A 1.25 scale from 15: 40 display, 28 title, 20 heading, 17 body, 14 small. The check-in text is set larger (26) because it's read at arm's length in the dark.

## Engagement, and where it stops

What we took from the research:
- **Streaks work through loss aversion**, but in calm products they should count showing up, not performance. Hushtick's streak is "nights closed," never "tasks completed."
- **Failure should feel safe.** A missed night uses a grace night, and the copy never guilt-trips.
- **Instant, visible feedback.** Ticking a task pops the check, buzzes, and adds a star.

Guardrails, because this is a bedtime app:
- One notification a day, at the user's bedtime. Nothing after.
- The check-in is capped at about four exchanges.
- After "Goodnight," the screen goes dark and closes itself. No feed, no "one more thing."
- No leaderboards or social pressure.

## Responsive behavior

- **Phones:** full-width, bottom tabs, floating mic.
- **900 px and wider (tablets, desktop web):** sidebar navigation, a two-column Today (tasks and tomorrow), a typing-first capture bar with a mic button, and centered reading columns elsewhere.
- **Web without speech recognition** (e.g. Firefox): voice buttons fall back to typing.
