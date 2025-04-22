# Voronoi4: Enhanced Semantic Voronoi Tessellation Explorer

Voronoi4 is an enhanced version of the Semantic Voronoi Tessellation Explorer, building on the foundation of Voronoi3. This application creates interactive visualizations of knowledge domains based on semantic relationships.

## Features

- Interactive Voronoi diagram for visualizing knowledge domains
- Document management with semantic analysis
- Question answering based on uploaded documents
- Nested hierarchies of domains and subdomains
- Semantic relationship visualization between domains
- Enhanced document processing and analysis
- Improved vector embedding and retrieval
- Better CORS configuration
- Streamlined user interface

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm
- OpenAI API key
- Pinecone account and API key

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/voronoi4.git
   cd voronoi4
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables:
   - Create `.env.local` in the frontend directory
   - Create `.env` in the backend directory
   - Add your API keys and configuration

4. Start the application:
   1. - ~/VerbumTechnologies/Voronoi3/backend% npm run dev 
   2. -~/VerbumTechnologies/Voronoi3/frontend% npm start  
   
## Usage

1. Begin by entering at least 3 domains/interests on the splash page
2. Navigate the Voronoi diagram by clicking on domains
3. Add subdomains to create hierarchical relationships
4. Upload documents to analyze within your domain context
5. Ask questions about your documents to get AI-powered answers

## Architecture

- Frontend: React.js
- Backend: Node.js with Express
- Vector Database: Pinecone
- Embeddings & AI: OpenAI

## Improvements in Voronoi4

- Enhanced document processing with better error handling
- More robust vector embedding and retrieval system
- Improved CORS configuration for better security
- Streamlined user interface with better UX
- Better performance optimization
- Enhanced error handling and logging
- Improved documentation

## License.
None
Copyright © Litchfield Capital Corporation. All rights reserved.
This repository is proprietary, and no license is granted to copy, modify, or distribute its contents.
