#!/bin/bash

# Navigate to the project directory
cd ~/VerbumTechnologies/voronoi1

# Create README and root package.json
touch README.md package.json .env

# Create frontend directory structure
mkdir -p frontend/public
mkdir -p frontend/src/components
mkdir -p frontend/src/context
mkdir -p frontend/src/utils
mkdir -p frontend/src/styles

# Create frontend files
touch frontend/package.json
touch frontend/public/index.html
touch frontend/public/favicon.ico
touch frontend/public/manifest.json

# Create frontend source files
touch frontend/src/index.js
touch frontend/src/App.js

# Create frontend context files
touch frontend/src/context/DomainContext.js

# Create frontend component files
touch frontend/src/components/VoronoiDiagram.js
touch frontend/src/components/Breadcrumbs.js
touch frontend/src/components/DomainPanel.js
touch frontend/src/components/DocumentUpload.js
touch frontend/src/components/QuestionAnswering.js
touch frontend/src/components/AppSettings.js
touch frontend/src/components/LoadingIndicator.js

# Create frontend utility files
touch frontend/src/utils/api.js
touch frontend/src/utils/embeddingUtils.js
touch frontend/src/utils/pathUtils.js

# Create frontend style files
touch frontend/src/styles/App.css
touch frontend/src/styles/VoronoiDiagram.css
touch frontend/src/styles/Breadcrumbs.css
touch frontend/src/styles/DomainPanel.css
touch frontend/src/styles/DocumentUpload.css
touch frontend/src/styles/QuestionAnswering.css
touch frontend/src/styles/AppSettings.css

# Create backend directory structure
mkdir -p backend/routes
mkdir -p backend/controllers
mkdir -p backend/models
mkdir -p backend/services
mkdir -p backend/utils

# Create backend files
touch backend/package.json
touch backend/server.js

# Create backend route files
touch backend/routes/embeddings.js
touch backend/routes/domains.js
touch backend/routes/documents.js
touch backend/routes/qa.js

# Create backend controller files
touch backend/controllers/embeddingController.js
touch backend/controllers/domainController.js
touch backend/controllers/documentController.js
touch backend/controllers/qaController.js

# Create backend model files
touch backend/models/Domain.js
touch backend/models/Document.js

# Create backend service files
touch backend/services/langchainService.js
touch backend/services/embeddingService.js
touch backend/services/storageService.js

# Create backend utility files
touch backend/utils/dimensionReduction.js
touch backend/utils/errorHandler.js

echo "Project structure created successfully!"