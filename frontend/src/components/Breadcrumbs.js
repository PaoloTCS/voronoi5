import React from 'react';

const Breadcrumbs = ({ path, onNavigate }) => {
  const aboutText = `This application explores the concept of representing the relationship of complex information, such as documents or groups of documents or datasets, within a geometric space or higher space based on their semantic and other relations.\n\nUsing embedding and dimensionality reduction, we can project higher dimensions into points in 2D or 3D space. The relationships between these items are then visualized using geometric structures:\n- Semantic Triangulation (2D): Shows relationships between 3 selected items. Points inside triangles represent weighted semantic combinations.\n- Semantic Tetrahedron (3D): Extends this concept to 4 selected items, allowing exploration of more complex four-way relationships within a tetrahedron volume.\n  To Come: n-dimensional space computations on objects\n\nThe goal is to provide an intuitive visual interface for navigating and understanding the connections and combinations within high-dimensional semantic spaces, moving beyond simple spatial representations towards interacting with the underlying tensor data.`;

  return (
    <div className="breadcrumbs">
      <span 
        className="breadcrumb-item home"
        onClick={() => onNavigate(0)}
        title={aboutText}
      >
        Home
      </span>
      
      {path.map((item, index) => (
        <React.Fragment key={index}>
          <span className="breadcrumb-separator">/</span>
          <span 
            className="breadcrumb-item"
            onClick={() => onNavigate(index + 1)}
          >
            {item}
          </span>
        </React.Fragment>
      ))}
      
      <style jsx="true">{`
        .breadcrumbs {
          padding: 15px;
          background-color: #f8f9fa;
          border-radius: 6px;
          margin-bottom: 15px;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
          font-size: 14px;
        }
        
        .breadcrumb-item {
          color: #3498db;
          cursor: pointer;
          font-weight: 500;
        }
        
        .breadcrumb-item:hover {
          text-decoration: underline;
        }
        
        .breadcrumb-separator {
          margin: 0 8px;
          color: #999;
        }
        
        .breadcrumb-item.home {
          font-weight: bold;
        }
      `}</style>
    </div>
  );
};

export default Breadcrumbs;