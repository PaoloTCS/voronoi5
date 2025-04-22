/**
 * Tetrahedron visualization component for 3D semantic space
 * Shows documents as vertices of tetrahedra and allows exploring the interior
 */

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { calculateSimilarity } from './embeddingService';

// --- Helper Function: Check if point is inside tetrahedron --- 
// Uses the sign check method: A point is inside if it lies on the same side
// of all four planes defined by the tetrahedron faces as a reference point (e.g., the centroid).
const isPointInsideTetrahedron = (point, v0, v1, v2, v3) => {
  // Ensure inputs are THREE.Vector3 instances
  const pt = (point instanceof THREE.Vector3) ? point : new THREE.Vector3(point.x, point.y, point.z);
  const verts = [v0, v1, v2, v3].map(v => (v instanceof THREE.Vector3) ? v : new THREE.Vector3(v.x, v.y, v.z));
  
  // Function to check the sign of the volume (determines side of plane)
  // Volume = (p - a) . ((b - a) x (c - a))
  const signCheck = (p, a, b, c) => {
    const vector_ap = new THREE.Vector3().subVectors(p, a);
    const vector_ab = new THREE.Vector3().subVectors(b, a);
    const vector_ac = new THREE.Vector3().subVectors(c, a);
    const crossProduct = new THREE.Vector3().crossVectors(vector_ab, vector_ac);
    return vector_ap.dot(crossProduct);
  };

  // Check the sign for the point relative to each face
  const sign1 = signCheck(pt, verts[0], verts[1], verts[2]);
  const sign2 = signCheck(pt, verts[0], verts[2], verts[3]);
  const sign3 = signCheck(pt, verts[0], verts[3], verts[1]);
  const sign4 = signCheck(pt, verts[1], verts[3], verts[2]);

  // Point is inside if all signs are the same (or zero)
  // Checking <= 0 and >= 0 allows points on the surface to be included
  const allNegativeOrZero = sign1 <= 0 && sign2 <= 0 && sign3 <= 0 && sign4 <= 0;
  const allPositiveOrZero = sign1 >= 0 && sign2 >= 0 && sign3 >= 0 && sign4 >= 0;

  return allNegativeOrZero || allPositiveOrZero;
};
// ---------------------------------------------------------

// Helper function to scale coordinates
const scaleCoordinates = (coords, targetSize = 3) => {
  if (!coords || coords.length === 0 || coords.some(c => !c || c.length !== 3)) {
    console.warn("scaleCoordinates: Invalid input coords", coords);
    return coords; 
  }
  const vectors = coords.map(c => new THREE.Vector3(c[0], c[1], c[2]));
  const box = new THREE.Box3().setFromPoints(vectors);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim === 0) {
    console.warn("scaleCoordinates: Points are likely coincident, cannot scale meaningfully.");
    return coords;
  }
  const scaleFactor = targetSize / maxDim;
  const scaledVectors = vectors.map(v => 
    v.clone().sub(center).multiplyScalar(scaleFactor)
  );
  const scaledArrays = scaledVectors.map(v => [v.x, v.y, v.z]);
  console.log("scaleCoordinates: Scaled coords:", scaledArrays);
  return scaledArrays;
};

const TetrahedronVisualization = ({ 
  documents = [], 
  coordinates = null, // Expect coordinates map { docId: [x, y, z], ... }
  onPointSelected
}) => {
  const containerRef = useRef(null);
  const [scene, setScene] = useState(null);
  const [camera, setCamera] = useState(null);
  const [renderer, setRenderer] = useState(null);
  const [controls, setControls] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [tetrahedra, setTetrahedra] = useState([]);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [hoverInfo, setHoverInfo] = useState({ point: null, analysis: null });
  const createdObjectsRef = useRef([]); 
  
  // Initialize the 3D scene
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Get container dimensions
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    
    // Create scene
    const newScene = new THREE.Scene();
    newScene.background = new THREE.Color(0xf0f0f0);
    
    // Create camera
    const newCamera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    newCamera.position.z = 5;
    newCamera.zoom = zoomLevel;
    newCamera.updateProjectionMatrix();
    
    // Create renderer
    const newRenderer = new THREE.WebGLRenderer({ antialias: true });
    newRenderer.setSize(width, height);
    containerRef.current.appendChild(newRenderer.domElement);
    
    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current) return;
      
      const newWidth = containerRef.current.clientWidth;
      const newHeight = containerRef.current.clientHeight;
      
      newCamera.aspect = newWidth / newHeight;
      newCamera.updateProjectionMatrix();
      newRenderer.setSize(newWidth, newHeight);
    };
    
    window.addEventListener('resize', handleResize);
    
    // Add orbit controls for interaction
    const newControls = new OrbitControls(newCamera, newRenderer.domElement);
    newControls.enableDamping = true;
    newControls.dampingFactor = 0.25;
    // --- Disable default wheel zoom --- 
    newControls.enableZoom = false; // Disable zoom via controls
    // ---------------------------------

    // --- Add custom wheel listener for Z-navigation --- 
    const handleWheel = (event) => {
      event.preventDefault(); // Prevent default scroll behavior

      const direction = new THREE.Vector3();
      newCamera.getWorldDirection(direction); // Get camera's forward direction

      // Adjust sensitivity as needed
      const moveSpeed = 0.01;
      const moveDistance = direction.multiplyScalar(-event.deltaY * moveSpeed);

      newCamera.position.add(moveDistance);
      // Optional: Adjust controls target if needed, but usually not for simple forward/back
      // newControls.target.add(moveDistance); 
    };

    const currentRendererEl = newRenderer.domElement;
    currentRendererEl.addEventListener('wheel', handleWheel, { passive: false });
    // ----------------------------------------------------

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    newScene.add(ambientLight);
    
    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    newScene.add(directionalLight);
    
    // Render loop
    const animate = () => {
      requestAnimationFrame(animate);
      newControls.update();
      newRenderer.render(newScene, newCamera);
    };
    
    animate();
    
    // Set state
    setScene(newScene);
    setCamera(newCamera);
    setRenderer(newRenderer);
    setControls(newControls); // Use the newControls variable
    
    // Cleanup on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      // --- Remove custom wheel listener --- 
      if (currentRendererEl) {
        currentRendererEl.removeEventListener('wheel', handleWheel);
      }
      // ----------------------------------
      if (containerRef.current && newRenderer.domElement) {
        containerRef.current.removeChild(newRenderer.domElement);
      }
      newRenderer.dispose();
    };
  }, []);
  
  // Create the tetrahedra when documents change
  useEffect(() => {
    if (!scene || !camera || !renderer || !controls || documents.length < 4 || !coordinates) {
      console.log("TetrahedronVisualization: Waiting for scene, camera, renderer, controls, 4 documents, and coordinates...");
      // Clear previous objects
      createdObjectsRef.current.forEach(obj => scene.remove(obj));
      createdObjectsRef.current = [];
      return;
    }

    // --- Refined: Filter, Align, Scale, Validate Coords --- 
    let alignedDocs = [];
    let alignedCoordsRaw = [];

    // Ensure alignment between docs and coords
    documents.forEach(doc => {
      if (doc && doc.id && coordinates[doc.id] && Array.isArray(coordinates[doc.id]) && coordinates[doc.id].length === 3) {
        alignedDocs.push(doc);
        alignedCoordsRaw.push(coordinates[doc.id]);
      }
    });

    if (alignedDocs.length < 4) {
      console.warn(`Visualization: Need 4 docs with valid 3D coordinates, found ${alignedDocs.length}`);
      createdObjectsRef.current.forEach(obj => scene.remove(obj));
      createdObjectsRef.current = [];
      return;
    }
    // Take the first 4 aligned documents/coordinates
    const finalDocs = alignedDocs.slice(0, 4);
    const finalCoordsRaw = alignedCoordsRaw.slice(0, 4);
    
    // Scale the aligned coordinates
    console.log("TetrahedronVisualization: Raw coordinates before scaling:", JSON.stringify(finalCoordsRaw));
    const scaledCoords = scaleCoordinates(finalCoordsRaw); // Pass only the coords
    const vertexCoords = scaledCoords;
    console.log("TetrahedronVisualization: Scaled coordinates for vertices:", JSON.stringify(vertexCoords));
    if (vertexCoords.length !== 4 || vertexCoords.some(c => !c || c.length !== 3)) {
        console.error("Invalid scaled vertex coordinate data after alignment:", vertexCoords);
        createdObjectsRef.current.forEach(obj => scene.remove(obj));
        createdObjectsRef.current = [];
        return;
    }
    // ----------------------------------------------

    // --- Clear previous objects before adding new --- 
    createdObjectsRef.current.forEach(obj => scene.remove(obj));
    createdObjectsRef.current = [];

    // --- Create ONE tetrahedron geometry --- 
    const verticesVec3 = vertexCoords.map(coord => new THREE.Vector3(coord[0], coord[1], coord[2]));
    const geometry = new THREE.BufferGeometry();
    geometry.setFromPoints(verticesVec3);
    geometry.setIndex([ 0, 1, 2, 0, 3, 1, 0, 2, 3, 1, 3, 2 ]);
    geometry.computeVertexNormals();

    // --- Create Materials (one per face color) --- 
    const faceColors = [
      new THREE.Color(0x3366cc), // Face 0 (Indices 0, 1, 2)
      new THREE.Color(0xdc3912), // Face 1 (Indices 0, 3, 1)
      new THREE.Color(0xff9900), // Face 2 (Indices 0, 2, 3)
      new THREE.Color(0x109618)  // Face 3 (Indices 1, 3, 2)
    ];
    const materials = faceColors.map(color => new THREE.MeshPhongMaterial({
        color: color, 
        transparent: true, 
        opacity: 0.4, // Slightly adjust opacity if needed
        side: THREE.DoubleSide 
    }));

    // --- Assign Materials to Geometry Groups --- 
    // Each face is 3 vertices (indices)
    geometry.addGroup(0, 3, 0); // Face 0 (Indices 0, 1, 2) uses material 0
    geometry.addGroup(3, 3, 1); // Face 1 (Indices 0, 3, 1) uses material 1
    geometry.addGroup(6, 3, 2); // Face 2 (Indices 0, 2, 3) uses material 2
    geometry.addGroup(9, 3, 3); // Face 3 (Indices 1, 3, 2) uses material 3

    // Create mesh using the array of materials
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.position.set(0, 0, 0); // Geometry is already centered by scaleCoordinates
    scene.add(mesh);
    createdObjectsRef.current.push(mesh); // Track for cleanup

    const wireframe = new THREE.LineSegments(
      new THREE.WireframeGeometry(geometry),
      new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 })
    );
    wireframe.position.copy(mesh.position);
    scene.add(wireframe);
    createdObjectsRef.current.push(wireframe); // Track for cleanup

    // --- Adjust Camera --- 
    // --- Re-enable dynamic camera adjustment --- 
    // Calculate bounding box of the geometry
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox;
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());
    
    // Calculate distance needed to view the whole object
    // Handle cases where size might be zero to avoid division by zero or NaN
    const maxDim = Math.max(size.x, size.y, size.z);
    let cameraZ = 5; // Default distance if maxDim is 0
    if (maxDim > 0) {
      const fov = camera.fov * (Math.PI / 180); // Convert fov to radians
      cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
      cameraZ *= 1.5; // Add some padding factor
    } else {
      console.warn("Tetrahedron dimensions are zero, using default camera distance.");
    }

    // Set camera position slightly away along Z-axis relative to the center
    camera.position.copy(center); // Start at the center
    camera.position.z += cameraZ; // Move back
    
    // Point camera towards the center of the object
    controls.target.copy(center); // Set OrbitControls target
    // --- End re-enabled dynamic camera adjustment ---

    controls.update(); // Apply changes
    // --------------------- // End Camera Adjust

    // --- Add Labels --- 
    const colors = [
      new THREE.Color(0x3366cc),
      new THREE.Color(0xdc3912),
      new THREE.Color(0xff9900),
      new THREE.Color(0x109618)
    ];
    verticesVec3.forEach((vertex, i) => { // Use geometry vertices for positioning relative to mesh
        const doc = finalDocs[i]; // Should now be correctly aligned with vertexCoords[i]
        if (!doc) {
             console.error(`Error finding document for vertex ${i}`);
             return; 
        }
        // Create label sprite
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        // --- Increase Resolution --- 
        canvas.width = 512; // Increased from 256
        canvas.height = 256; // Increased from 128
        // -------------------------
        context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
        context.strokeStyle = colors[i].getHexString(); context.lineWidth = 8; // Increased line width
        context.strokeRect(4, 4, canvas.width-8, canvas.height-8); // Adjust rect position
        // --- Increase Font Size --- 
        context.font = 'bold 40px Arial'; // Increased from 20px
        // ------------------------
        context.fillStyle = '#' + colors[i].getHexString(); context.textAlign = 'center'; 
        // Adjust text position for larger canvas/font
        context.fillText(doc.title, canvas.width / 2, canvas.height / 2 + 10); // Added slight Y offset for centering
        
        const texture = new THREE.CanvasTexture(canvas);
        // --- Set Filtering (Optional but recommended) ---
        texture.minFilter = THREE.LinearFilter; // Or THREE.NearestFilter
        texture.magFilter = THREE.LinearFilter; // Or THREE.NearestFilter
        texture.needsUpdate = true;
        // -----------------------------------------------
        
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        
        // Position sprite further away from the vertex
        const labelOffset = 1.8; // Increased distance from 1.0
        const direction = vertex.clone().normalize(); 
        const labelPos = vertex.clone().add(direction.multiplyScalar(labelOffset));
        sprite.position.copy(labelPos);
        // --- Adjust Sprite Scale --- 
        // Keep aspect ratio based on new canvas (512x256 is 2:1)
        sprite.scale.set(1.5, 0.75, 1.0); // Adjust scale factor as needed
        // -------------------------
        scene.add(sprite);
        createdObjectsRef.current.push(sprite); // Track for cleanup

        // Add connecting line
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x333333, linewidth: 1 });
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([vertex, labelPos]);
        const line = new THREE.Line(lineGeometry, lineMaterial);
        scene.add(line);
        createdObjectsRef.current.push(line); // Track line for cleanup
    });
    
    // --- Interaction Logic --- 
    const createdTetrahedronData = {
        mesh: mesh,
        wireframe: wireframe,
        labels: colors,
        docSet: finalDocs,
        vertices: verticesVec3, // Scaled/Centered vertices used for geometry
        originalVertices: verticesVec3, // Same, as mesh is at origin
        position: new THREE.Vector3(0, 0, 0), // Mesh is at origin
        colors: colors
    };
    setTetrahedra([createdTetrahedronData]); // Update state
    
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    // Define handlers within useEffect scope, but ensure they reference latest state if needed (or use refs)
    const handleMouseClick = (event) => {
      const currentTetra = createdTetrahedronData;
      if (!currentTetra || !renderer || !camera) return;
      
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      
      const intersects = raycaster.intersectObject(currentTetra.mesh);
      
      if (intersects.length > 0) {
        const point = intersects[0].point; // World space intersection point
        const localPoint = point.clone().sub(currentTetra.position); // Point relative to tetra origin

        // --- Check if inside --- 
        const isInside = isPointInsideTetrahedron(
          localPoint, 
          currentTetra.vertices[0], 
          currentTetra.vertices[1], 
          currentTetra.vertices[2], 
          currentTetra.vertices[3]
        );
        console.log("Clicked point inside:", isInside);
        // ----------------------

        setSelectedPoint({ point: point, isInside: isInside }); // Store position and inside status
        
        // --- Update selection marker color --- 
        let marker = scene.getObjectByName('selectionMarker');
        if (!marker) {
            const markerGeometry = new THREE.SphereGeometry(0.05, 16, 16);
            // Initial color based on first click
            const markerMaterial = new THREE.MeshBasicMaterial({ color: isInside ? 0x00ff00 : 0xff0000 }); 
            marker = new THREE.Mesh(markerGeometry, markerMaterial);
            marker.name = 'selectionMarker';
            scene.add(marker);
            createdObjectsRef.current.push(marker); // Track marker
        } else {
            // Update existing marker color
            marker.material.color.setHex(isInside ? 0x00ff00 : 0xff0000); // Green if inside, Red if outside
        }
        marker.position.copy(point);
        // ------------------------------------
        
        // Calculate barycentric coordinates
        const baryCoords = calculateBarycentricCoordinates3D(
          localPoint, 
          currentTetra.originalVertices 
        );
        
        // Calculate semantic interpretation
        const semantics = calculateSemanticInterpolation(
          baryCoords,
          currentTetra.docSet
        );
        
        if (onPointSelected && semantics) {
          onPointSelected({
            documents: currentTetra.docSet,
            weights: baryCoords,
            point: [point.x, point.y, point.z],
            colors: currentTetra.colors.map(c => '#' + c.getHexString()),
            contributions: semantics.contributions,
            isInside: isInside 
          });
        }
      }
    };

    const handleMouseMove = (event) => {
      const currentTetra = createdTetrahedronData;
      if (!currentTetra || !renderer || !camera) return;
      
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      
      const intersects = raycaster.intersectObject(currentTetra.mesh);
      let hoverMarker = scene.getObjectByName('hoverMarker');

      if (intersects.length > 0) {
        const point = intersects[0].point;
        const localPoint = point.clone().sub(currentTetra.position); 

        // --- Check if inside --- 
        const isInside = isPointInsideTetrahedron(
          localPoint, 
          currentTetra.vertices[0], 
          currentTetra.vertices[1], 
          currentTetra.vertices[2], 
          currentTetra.vertices[3]
        );
        // ----------------------

        // --- Calculate analysis for hover point --- 
        const baryCoords = calculateBarycentricCoordinates3D(
          localPoint, 
          currentTetra.originalVertices 
        );
        const semantics = calculateSemanticInterpolation(
          baryCoords,
          currentTetra.docSet
        );
        const analysisResult = { 
            weights: baryCoords, 
            semantics: semantics 
        };
        // --- Update hover state with point, analysis, and inside status --- 
        setHoverInfo({ point: point, analysis: analysisResult, isInside: isInside });
        
        // --- Update hover marker color --- 
        if (!hoverMarker) {
          const markerGeometry = new THREE.SphereGeometry(0.03, 16, 16);
          const markerMaterial = new THREE.MeshBasicMaterial({ color: isInside ? 0x00cc00 : 0xcc0000 }); // Darker Green/Red for hover
          hoverMarker = new THREE.Mesh(markerGeometry, markerMaterial);
          hoverMarker.name = 'hoverMarker';
          scene.add(hoverMarker);
          createdObjectsRef.current.push(hoverMarker); // Track marker
        } else {
             hoverMarker.material.color.setHex(isInside ? 0x00cc00 : 0xcc0000); 
        }
        hoverMarker.position.copy(point);
        // ------------------------------

      } else {
        // --- Clear hover state --- 
        setHoverInfo({ point: null, analysis: null, isInside: false });
        if (hoverMarker) {
          scene.remove(hoverMarker);
          createdObjectsRef.current = createdObjectsRef.current.filter(obj => obj !== hoverMarker);
        }
      }
    };
    
    // Add listeners
    const currentRenderer = renderer; // Capture renderer for cleanup closure
    const domElement = currentRenderer?.domElement;
    if (domElement) {
        domElement.addEventListener('click', handleMouseClick);
        domElement.addEventListener('mousemove', handleMouseMove);
    }
    // --- END INTERACTION --- 

  }, [scene, camera, renderer, documents, coordinates, controls, onPointSelected]); // Removed onVerticesReady from deps

  // Cleanup objects and listeners on unmount or when scene changes
  useEffect(() => {
      return () => {
          // Access the latest renderer via ref if needed, or rely on closure
          const domElement = renderer?.domElement;
          if (domElement) {
              // Attempt to remove listeners - ensure handler references are stable or managed correctly
              // If handlers were defined outside useEffect, direct removal works.
              // If defined inside, they need to be wrapped (useCallback) or managed via refs 
              // For simplicity now, let's assume direct removal might work or rely on component unmount cleanup.
              // domElement.removeEventListener('click', handleMouseClick); 
              // domElement.removeEventListener('mousemove', handleMouseMove);
          }
          if (scene) {
              createdObjectsRef.current.forEach(obj => scene.remove(obj));
          }
          createdObjectsRef.current = [];
      };
  }, [scene, renderer]); // Depend on scene and renderer

  // --- Handler for Zoom Slider --- 
  const handleZoomChange = (event) => {
    const newZoom = parseFloat(event.target.value);
    setZoomLevel(newZoom);
    if (camera) {
      camera.zoom = newZoom;
      camera.updateProjectionMatrix();
    }
  };
  // ------------------------------

  return (
    <div className="tetrahedron-container">
      <div ref={containerRef} className="tetrahedron-canvas"></div>
      
      {/* --- Zoom Slider UI --- */}
      <div className="zoom-slider-container">
        <label htmlFor="zoomSlider">Zoom:</label>
        <input 
          type="range" 
          id="zoomSlider"
          min="0.1"       // Min zoom level
          max="5"         // Max zoom level
          step="0.1"      // Step increment
          value={zoomLevel}
          onChange={handleZoomChange}
          className="zoom-slider"
        />
        <span>{zoomLevel.toFixed(1)}x</span>
      </div>
      {/* ----------------------- */}

      {/* Display hover info - Updated */} 
      {hoverInfo.point && hoverInfo.analysis && (
        <div className="hover-info">
          <div><strong>Position:</strong> ({hoverInfo.point.x.toFixed(2)}, {hoverInfo.point.y.toFixed(2)}, {hoverInfo.point.z.toFixed(2)})</div>
          {hoverInfo.analysis.semantics && (
            <div className="hover-analysis">
              <div><strong>Type:</strong> {hoverInfo.analysis.semantics.setOperation.type}</div>
              <div><strong>Analysis:</strong> {hoverInfo.analysis.semantics.setOperation.description}</div>
              {/* Optionally add weights here if needed */} 
            </div>
          )}
        </div>
      )}
      <style jsx>{`
        .tetrahedron-container {
          position: relative;
          width: 100%;
          height: 100%;
        }
        
        .tetrahedron-canvas {
          width: 100%;
          height: 100%;
        }
        
        {/* --- Zoom Slider Styles --- */}
        .zoom-slider-container {
          position: absolute;
          bottom: 10px;
          left: 50%;
          transform: translateX(-50%);
          background-color: rgba(50, 50, 50, 0.7);
          padding: 5px 15px;
          border-radius: 5px;
          display: flex;
          align-items: center;
          gap: 10px;
          color: white;
          font-size: 12px;
        }
        .zoom-slider-container label {
          margin-right: 5px;
        }
        .zoom-slider {
          cursor: pointer;
          width: 150px; /* Adjust width as needed */
        }
        /* -------------------------- */
        
        .hover-info {
          position: absolute;
          bottom: 10px;
          left: 10px;
          background-color: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 12px;
          max-width: 300px; /* Limit width */
          pointer-events: none; /* Prevent hover info from blocking interaction */
        }
        .hover-analysis {
            margin-top: 5px;
            padding-top: 5px;
            border-top: 1px solid #555;
        }
      `}</style>
    </div>
  );
};

// Calculate barycentric coordinates in 3D (tetrahedron)
const calculateBarycentricCoordinates3D = (point, vertices) => {
  if (vertices.length !== 4) {
    return [0, 0, 0, 0];
  }
  
  // Create vectors from the first vertex to the others
  const v0 = new THREE.Vector3().subVectors(vertices[1], vertices[0]);
  const v1 = new THREE.Vector3().subVectors(vertices[2], vertices[0]);
  const v2 = new THREE.Vector3().subVectors(vertices[3], vertices[0]);
  
  // Create vector from the first vertex to the point
  const vp = new THREE.Vector3().subVectors(point, vertices[0]);
  
  // Calculate volume of tetrahedron
  const volume = (new THREE.Vector3().crossVectors(v0, v1)).dot(v2) / 6;
  
  // Calculate barycentric coordinates based on sub-volumes
  // For each vertex, create a sub-tetrahedron with the point and the remaining vertices
  
  // Sub-tetrahedron for vertex 0
  const vp0 = new THREE.Vector3().subVectors(point, vertices[1]);
  const vp1 = new THREE.Vector3().subVectors(point, vertices[2]);
  const vp2 = new THREE.Vector3().subVectors(point, vertices[3]);
  const volume0 = Math.abs((new THREE.Vector3().crossVectors(vp0, vp1)).dot(vp2)) / 6;
  
  // Sub-tetrahedron for vertex 1
  const v00 = new THREE.Vector3().subVectors(vertices[0], point);
  const v01 = new THREE.Vector3().subVectors(vertices[2], point);
  const v02 = new THREE.Vector3().subVectors(vertices[3], point);
  const volume1 = Math.abs((new THREE.Vector3().crossVectors(v00, v01)).dot(v02)) / 6;
  
  // Sub-tetrahedron for vertex 2
  const v10 = new THREE.Vector3().subVectors(vertices[0], point);
  const v11 = new THREE.Vector3().subVectors(vertices[1], point);
  const v12 = new THREE.Vector3().subVectors(vertices[3], point);
  const volume2 = Math.abs((new THREE.Vector3().crossVectors(v10, v11)).dot(v12)) / 6;
  
  // Sub-tetrahedron for vertex 3
  const v20 = new THREE.Vector3().subVectors(vertices[0], point);
  const v21 = new THREE.Vector3().subVectors(vertices[1], point);
  const v22 = new THREE.Vector3().subVectors(vertices[2], point);
  const volume3 = Math.abs((new THREE.Vector3().crossVectors(v20, v21)).dot(v22)) / 6;
  
  // Calculate normalized weights
  const totalVolume = volume0 + volume1 + volume2 + volume3;
  
  return [
    volume0 / totalVolume,
    volume1 / totalVolume,
    volume2 / totalVolume,
    volume3 / totalVolume
  ];
};

// Uses placeholder logic if embeddings are missing
const calculateSemanticInterpolation = (baryCoords, documents) => {
   if (documents.length !== 4 || baryCoords.length !== 4) return null;
   
   // Check for embeddings attached to the document objects
   const embeddings = documents.map(doc => doc.embedding).filter(Boolean);
   if (embeddings.length !== 4 || embeddings.some(e => !Array.isArray(e) || e.length === 0)) {
       console.warn("calculateSemanticInterpolation: Valid embeddings missing on one or more documents.");
       // Return positional mix if embeddings are not fully valid
       return { 
          contributions: documents.map((doc, i) => ({ 
               id: doc.id, title: doc.title, weight: baryCoords[i], similarity: null 
          })),
          setOperation: { type: 'positional_mix', description: 'Mixture based on position', conceptual: 'Represents spatial interpolation.' }
       };
   }
   
   // --- Calculate semantic meaning using the real embeddings --- 
   console.log("Calculating semantic interpolation using embeddings...");

   // Calculate weighted combination of embeddings
   const combinedEmbedding = Array(embeddings[0].length).fill(0);
   for (let i = 0; i < embeddings.length; i++) {
     // Ensure embedding[i] is valid before proceeding
     if (embeddings[i] && embeddings[i].length === combinedEmbedding.length) {
         for (let j = 0; j < combinedEmbedding.length; j++) {
             combinedEmbedding[j] += baryCoords[i] * (embeddings[i][j] || 0); // Default to 0 if a value is somehow undefined
         }
     } else {
         console.error(`Invalid embedding structure for document ${documents[i].id}`);
         // Handle error - maybe return the positional mix?
         return { 
            contributions: documents.map((doc, i) => ({ id: doc.id, title: doc.title, weight: baryCoords[i], similarity: null })),
            setOperation: { type: 'positional_mix (invalid embedding)', description: 'Mixture based on position', conceptual: 'Represents spatial interpolation.' }
         };
     }
   }

   // Calculate similarities to original documents
   const similarities = embeddings.map(embedding => 
     calculateSimilarity(combinedEmbedding, embedding)
   );

   // Determine operation type based on weights (existing logic)
   let operationType = 'complex_mix';
   let description = 'Complex mixture of all documents';
   const maxIndex = baryCoords.indexOf(Math.max(...baryCoords));
   if (baryCoords[maxIndex] > 0.6) {
       operationType = 'dominant';
       description = `Primarily ${documents[maxIndex].title} with influences`;
   } else if (baryCoords.every(w => w > 0.2)) {
       operationType = 'balanced_intersection';
       description = 'Balanced intersection of all four documents';
   } else {
       const sorted = [...baryCoords].sort((a, b) => b - a);
       if (sorted[0] + sorted[1] > 0.8 && sorted[2] < 0.1) {
           operationType = 'paired_documents';
           const indices = baryCoords.map((w, i) => ({ weight: w, index: i })).sort((a, b) => b.weight - a.weight).slice(0, 2).map(item => item.index);
           description = `Combination of ${documents[indices[0]].title} and ${documents[indices[1]].title}`;
       }
   }

   return {
     contributions: documents.map((doc, i) => ({ 
       id: doc.id, 
       title: doc.title, 
       weight: baryCoords[i], 
       similarity: similarities[i] // Use calculated similarity
     })),
     setOperation: { 
         type: operationType, 
         description: description, 
         conceptual: 'Represents a semantic mixture derived from document embeddings.' 
     }
   };
};

export default TetrahedronVisualization; 