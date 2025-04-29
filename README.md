# Wi-FREE Telegram Bot

A Telegram bot that provides internet service plans with a "Show Me" feature that allows users to view daily messages with different access rules based on their subscription status.

## Features

- **Show Me Function**: Users can view a daily message, with usage limited to once per 24 hours for free users
- **Subscription Plans**:
  - 15GB Daily Surf (N200/day)
  - 3 Days Unlimited (N500/3 days)
  - 7 Days Unlimited (N1000/week)
- **Payment Processing**: Users can submit payment references for verification
- **Admin Panel**: For message management, payment approval, and statistics

Admins can deduct SMS fees with /deductsms <user_id> command

Admin can deduct SMS fees from all eligible users with "Deduct SMS Fee" button

View all users with the "View Users" button or /users command

View detailed user information with /user <chat_id> command

## Getting Started

### Prerequisites

- Node.js (14.x or higher)
- MongoDB
- Telegram Bot Token (from @BotFather)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/Rubiyy/wi-free-bot.git
   cd wi-free-bot
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file with the following variables:
   ```
   BOT_TOKEN=your_telegram_bot_token_here
   MONGODB_URI=mongodb://localhost:27017/wi-free-bot
   ADMIN_CHAT_ID=your_admin_chat_id_here
   ```

4. Start the bot:
   ```
   npm start
   ```

## Usage

### User Commands

- `/start` - Start the bot and view main menu
- `Show Me 🔎` - View today's message (once per 24h or unlimited with active plan)
- `My Plan 📊` - Check your active plan details
- `Buy Plan 💰` - View and subscribe to our plans
- `Help ℹ️` - Show help information

### Admin Commands

- `Set Message 📝` - Set the message that users can view
- `View Pending Payments 💲` - View and approve/decline pending payments
- `Statistics 📈` - View statistics about users and payments

## Project Structure

```
wi-free-bot/
├── index.js          # Main bot application
├── db.js             # Database connection
├── models/           # Database models
│   ├── index.js
│   ├── user.js
│   ├── adminMessage.js
│   └── payment.js
├── handlers/         # Command handlers
│   ├── index.js
│   ├── startHandler.js
│   ├── showMeHandler.js
│   ├── adminHandler.js
│   └── planHandler.js
├── middleware/       # Bot middleware
│   └── index.js
├── keyboards/        # Telegram keyboard markups
│   └── index.js
├── utils/            # Utility functions
│   └── index.js
└── .env              # Environment variables
```

## License

This project is licensed under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 
