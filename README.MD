# AtSameAge

A photo slideshow application that displays photos from your Immich instance of people who were the same age when their photos were taken.

## Overview

AtSameAge connects to your Immich instance and retrieves photos of people who have their birth dates registered. It then displays photos of different people who were the same age at the time the photo was taken, creating an interesting comparison across time and generations.

## Features

- 🔗 Connect to your Immich instance
- 📅 Automatic age calculation based on registered birth dates
- 🖼️ Photo slideshow of people at the same age
- 👥 Compare photos across different people and time periods
- 🎯 Easy-to-use interface

## Prerequisites

- An [Immich](https://immich.app/) instance with API access
- Python 3.8 or higher
- People in your Immich instance with birth dates configured

## Installation

1. Clone the repository:
```bash
git clone https://github.com/thekampany/atsameage.git
cd atsameage
```

2. Configure your Immich instance:
Create a `.env` file or set environment variables with your Immich instance details:
```bash
cp ..env.sample .env
```

```env
IMMICH_URL=https://your-immich-instance.com
IMMICH_API_KEY=your-api-key-here
```

## Usage

Run the application:
```bash
docker compose build
docker compose up -d
```

Then go to your browser and visit localhost:3000


## How It Works

1. **Data Collection**: The app has a task to periodically query your Immich instance for people with birth dates. You can also run the task manually.
2. **Age Calculation**: For each photo, it calculates how old the person was when the photo was taken
3. **Matching**: Groups photos by age across different people
4. **Display**: Shows photos in a slideshow format, highlighting the common age

## Contributing

Contributions are welcome! 

## Privacy Note

This application accesses personal information (birth dates and photos) from your Immich instance. Ensure you have appropriate permissions and comply with privacy regulations when using this tool.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built for use with [Immich](https://immich.app/)
- Inspired by the joy of comparing life moments across time

## Support

If you encounter any issues or have questions, please open an issue on GitHub.

---

