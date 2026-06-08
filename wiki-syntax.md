# Wiki Syntax Guide

This guide covers the formatting and syntax supported in this Wiki application.

## 1. Text Formatting

Standard Markdown formatting is supported for document styling.

- **Bold:** `**Bold Text**`
- **Italics:** `*Italic Text*`
- **Headers:** 
  - `# Header 1`
  - `## Header 2`
  - `### Header 3`
- **Lists:**
  - `* Bullet point`
  - `1. Numbered list`
- **Links:** `[Visible Text](https://url.com)`

## 2. Wiki Inter-linking

Create links to other pages within the wiki.

- **Basic Page Link:** `[[PageName]]`
  - *Example:* `[[HomePage]]` links to the HomePage.
- **Display Name Link:** `[[DisplayName|PageName]]`
  - *Example:* `[[Go to Home|HomePage]]` displays "Go to Home" but links to HomePage.

## 3. Multimedia Embedding

You can embed media files and external content using the specialized `![[...]]` syntax.

For detailed instructions and parameters (captions, dimensions, etc.), please refer to `multimedia.md`.

- **Images:** `![[image.png|Caption]]`
- **PDFs:** `![[document.pdf|HeightInPx]]`
- **Audio:** `![[track.mp3|Caption]]`
- **Local Video:** `![[video.mp4|WidthInPx]]`
- **YouTube:** `![[https://youtube.com/watch?v=VIDEO_ID|Caption]]`

## 4. Automatic Linking

If you simply type a filename or a valid URL, the system will automatically treat it as a potential link or embed if it matches known formats (PDFs, images, etc.). For precise control, always use the explicit `[[...]]` or `![[...]]` syntax.

## 5. Tables

Supported Markdown table syntax helps organize data efficiently.

```markdown
| Header 1 | Header 2 |
| :--- | :--- |
| Cell 1 | Cell 2 |
| Cell 3 | Cell 4 |
```

## 6. HTML

Basic HTML is supported for advanced formatting. Use it sparingly to maintain page consistency.

- **Example (Colored Text):** `<span style="color: blue;">Blue Text</span>`
- **Example (Block):** `<div class="p-2 bg-gray-100 rounded">Highlighted Block</div>`

