# Tourist Portal

Tourist Portal is a web application designed to enhance the experience of tourists by providing features like eKYC, chatbot assistance, and safety scores. The platform includes both a frontend (Next.js) and a backend (Python).

## Features
- **Frontend**: Built with Next.js, includes pages for tourists, admins, and dashboards.
- **Backend**: Python-based API for handling chatbot interactions and blockchain integration.
- **Database**: Integration with blockchain for secure data storage.

## Prerequisites
- Node.js (v16 or higher)
- Python (v3.9 or higher)
- pnpm (for managing frontend dependencies)

## Installation

### 1. Clone the Repository
```bash
git clone https://github.com/Sabharish-Varshaan/TOURIST-PORTAL.git
cd TOURIST-PORTAL
```

### 2. Setup Backend
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Create a `.env` file based on `.env.example` and configure the required environment variables.

### 3. Setup Frontend
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install Node.js dependencies:
   ```bash
   pnpm install
   ```
3. Start the development server:
   ```bash
   pnpm dev
   ```

## Running the Application

### Backend
1. Start the backend server:
   ```bash
   python main.py
   ```

### Frontend
1. Start the frontend development server:
   ```bash
   pnpm dev
   ```

## Contributing
Feel free to fork the repository and submit pull requests.

## License
This project is licensed under the MIT License.
