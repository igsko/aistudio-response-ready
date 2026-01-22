# AI Studio Response Ready Ping

A Tampermonkey user script that plays an audible ping when the model response is ready in Google AI Studio.

## Overview

This script automatically detects when a model has finished generating a response in [Google AI Studio](https://aistudio.google.com/) and plays a notification sound to alert you. Perfect for long-running prompts where you might not be actively watching the screen.

## Features

- Automatic audio notification when response is ready
- Works specifically with Google AI Studio prompts
- Lightweight and minimal performance impact

## Installation

### Prerequisites

You need a browser extension that can run user scripts:
- [Tampermonkey](https://www.tampermonkey.net/) (recommended)
- [Greasemonkey](https://www.greasespot.net/)
- Or any other compatible user script manager

### Steps

1. Install Tampermonkey or your preferred user script manager from your browser's extension store
2. Click the Tampermonkey icon in your browser and select "Create a new script"
3. Copy the entire contents of `AI Studio Response Ready Ping-0.9.1.user.js` into the editor
4. Save the script (usually Ctrl+S or ⌘+S)
5. The script will automatically activate when you visit Google AI Studio

## Usage

1. Navigate to [aistudio.google.com](https://aistudio.google.com/)
2. Create or open a prompt
3. Submit a query to the model
4. When the response is ready, you'll hear a ping sound

## Configuration

Edit the script to customize its behavior:

```javascript
const DEBUG = false;  // Set to true to enable console logging
const AUDIO_URL = "http://codeskulptor-demos.commondatastorage.googleapis.com/pang/pop.mp3";  // Custom sound URL
```

### Debug Mode

Enable `DEBUG = true` to see detailed console logs about the script's operation. Open your browser's developer console (F12) to view the logs.

### Custom Notification Sound

Replace the `AUDIO_URL` with a publicly accessible MP3 file:

```javascript
const AUDIO_URL = "https://your-domain.com/notification-sound.mp3";
```

## How It Works

The script uses a hierarchical MutationObserver system:

1. **Load Observer**: Detects when the chat session has fully loaded by watching for the removal of the `prompt-loader` element
2. **Main Observer**: Watches for new model response containers (elements with `data-turn-role="Model"`)
3. **Inner Observer**: Monitors the response container for the actual response content (`ms-text-chunk` or `ms-thought-chunk` elements) and triggers the audio notification

## Version History

- **0.9.1** - Current version

## License

MIT

## Author

igsko

## Credits

- **Audio**: "Blop" by Mark DiAngelo from [SoundBible](https://soundbible.com/) - Licensed under [Attribution 3.0](https://creativecommons.org/licenses/by/3.0/)

## Troubleshooting

- **Sound not playing?** Check if your browser allows autoplay. Some browsers require user interaction first.
- **Script not triggering?** Enable debug mode and check the console for any errors
- **Sound blocked?** Your browser's autoplay policy may block audio. Allow autoplay for aistudio.google.com

## Contributing

Feel free to report issues or suggest improvements!
