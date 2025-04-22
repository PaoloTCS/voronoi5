import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';

// Helper to parse query params
function useQuery() {
  return new URLSearchParams(useLocation().search);
}

// Simple linear scale function
const createScale = (domainMin, domainMax, rangeMin, rangeMax) => {
  // Handle case where min and max are the same (e.g., single point, or all points identical)
  if (domainMin === domainMax) {
    return () => (rangeMin + rangeMax) / 2; // Center the point
  }
  return (value) => {
    const domainRange = domainMax - domainMin;
    const rangeRange = rangeMax - rangeMin;
    // Clamp value to domain to avoid extrapolation issues if needed, though UMAP shouldn't exceed fit bounds
    // const clampedValue = Math.max(domainMin, Math.min(value, domainMax)); 
    const normalized = (value - domainMin) / domainRange;
    return normalized * rangeRange + rangeMin;
  };
};

const AnalysisPage = () => {
  const query = useQuery();
  const [itemIds, setItemIds] = useState([]);
  const [coordinates, setCoordinates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  console.log("AnalysisPage rendering"); // Log component renders

  useEffect(() => {
    console.log("AnalysisPage useEffect triggered"); // Log effect runs
    const id1 = query.get('item1');
    const id2 = query.get('item2');
    const id3 = query.get('item3');

    if (id1 && id2 && id3) {
      const ids = [id1, id2, id3];
      setItemIds(ids);
      console.log("AnalysisPage: Received item IDs:", ids);

      const fetchCoordinates = async () => {
        setLoading(true);
        setError(null);
        try {
          console.log("Fetching 2D coordinates (using fetch)...");
          
          // Use fetch API
          const response = await fetch('/api/analysis/triangle-2d', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ itemIds: ids }),
          });

          if (!response.ok) {
             // Try to parse error JSON from backend, otherwise use status text
            let errorMsg = response.statusText;
            try {
                const errorData = await response.json();
                errorMsg = errorData.message || errorMsg;
            } catch (parseError) {
                 // Ignore if response body is not JSON
            }
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorMsg}`);
          }

          const data = await response.json(); // Parse JSON response

          if (data && data.success && Array.isArray(data.coordinates)) {
              console.log("Received coordinates:", data.coordinates);
              setCoordinates(data.coordinates);
          } else {
              throw new Error(data.message || "Invalid response format from analysis endpoint.");
          }

        } catch (err) {
          // Catch both network errors (fetch promise rejection) and HTTP errors thrown above
          console.error("Error fetching analysis coordinates:", err);
          // Avoid setting error based on response if it was a network error (err.response won't exist)
          setError(err.message || "Failed to fetch analysis data (Network or server error).");
          setCoordinates([]);
        } finally {
          setLoading(false);
        }
      };

      fetchCoordinates();
    } else {
      setError("Missing item IDs in URL parameters.");
      console.log("AnalysisPage: Missing item IDs");
    }

  // IMPORTANT: Ensure dependencies are stable. useQuery() might return a new object each time.
  // Let's stringify the search params to make the dependency stable if params are the same.
  }, [query.toString()]); 

  // --- Calculate scales based on coordinates --- 
  const { xScale, yScale, dataToBoundsRatio } = useMemo(() => {
      if (!coordinates || coordinates.length === 0) {
          return { xScale: () => 0, yScale: () => 0, dataToBoundsRatio: 1 };
      }

      const padding = 20; // Pixel padding within SVG
      const svgWidth = 400;
      const svgHeight = 400;

      const xCoords = coordinates.map(c => c.x);
      const yCoords = coordinates.map(c => c.y);

      const minX = Math.min(...xCoords);
      const maxX = Math.max(...xCoords);
      const minY = Math.min(...yCoords);
      const maxY = Math.max(...yCoords);
      
      // Calculate data range
      const dataWidth = maxX - minX;
      const dataHeight = maxY - minY;

      // Determine the effective drawing area ranges
      const rangeXMin = padding;
      const rangeXMax = svgWidth - padding;
      const rangeYMin = padding;
      const rangeYMax = svgHeight - padding;
      
      // Calculate ratios to scale data proportionally to fit SVG area
      const scaleX = dataWidth === 0 ? 1 : (rangeXMax - rangeXMin) / dataWidth;
      const scaleY = dataHeight === 0 ? 1 : (rangeYMax - rangeYMin) / dataHeight;
      
      // Use the smaller scale factor to ensure the entire aspect ratio fits
      const scale = Math.min(scaleX, scaleY);
      
      // Calculate the effective width/height in the SVG after scaling
      const effectiveWidth = dataWidth * scale;
      const effectiveHeight = dataHeight * scale;
      
      // Center the plot within the SVG drawing area
      const offsetX = (rangeXMax - rangeXMin - effectiveWidth) / 2;
      const offsetY = (rangeYMax - rangeYMin - effectiveHeight) / 2;

      // Create final scaling functions
      const finalXScale = (x) => rangeXMin + offsetX + (x - minX) * scale;
      const finalYScale = (y) => rangeYMin + offsetY + (y - minY) * scale;

      return {
          xScale: finalXScale,
          yScale: finalYScale,
          // Optional: Store aspect ratio info if needed later
          dataToBoundsRatio: scale 
      };

  }, [coordinates]);
  // -------------------------------------------

  return (
    <div style={{ padding: '20px' }}>
      <Link to="/">Back to Main View</Link>
      <h1>2D Triangle Analysis</h1>
      <p>Analyzing items: {itemIds.join(', ') || 'Loading...'}</p>

      {loading && <p>Loading analysis data...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {!loading && !error && coordinates.length === 3 && (
        <div style={{ marginTop: '20px' }}>
          <h2>Visualization</h2>
          <svg width="400" height="400" style={{ border: '1px solid black' }}>
            {/* Use scales for positioning */}
            {coordinates.map((coord) => (
              <circle 
                key={coord.id} 
                cx={xScale(coord.x)} // Use scale
                cy={yScale(coord.y)} // Use scale
                r="5"
                fill="blue"
              />
            ))}
            {/* Draw triangle lines using scales */}
            <line 
              x1={xScale(coordinates[0].x)}
              y1={yScale(coordinates[0].y)}
              x2={xScale(coordinates[1].x)}
              y2={yScale(coordinates[1].y)}
              stroke="black"
            />
             <line 
              x1={xScale(coordinates[1].x)}
              y1={yScale(coordinates[1].y)}
              x2={xScale(coordinates[2].x)}
              y2={yScale(coordinates[2].y)}
              stroke="black"
            />
             <line 
              x1={xScale(coordinates[2].x)}
              y1={yScale(coordinates[2].y)}
              x2={xScale(coordinates[0].x)}
              y2={yScale(coordinates[0].y)}
              stroke="black"
            />
            {/* Add labels using scales */}
             {coordinates.map((coord) => (
               <text 
                 key={`${coord.id}-label`}
                 x={xScale(coord.x) + 7} // Offset from circle center
                 y={yScale(coord.y) + 3} // Offset from circle center
                 fontSize="10"
               >
                 {/* Extract original name from prefixed ID for display */}
                 {coord.id.split('::')[1] || coord.id}
               </text>
             ))}
          </svg>
          <pre>Raw Coordinates: {JSON.stringify(coordinates, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default AnalysisPage; 