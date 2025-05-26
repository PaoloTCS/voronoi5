import pytest
from unittest.mock import patch, MagicMock
import networkx as nx
import sys
import os

# Adjust sys.path to allow imports from the project root
_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from models.knowledge_graph import KnowledgeGraph

# --- Test Case ---

def test_update_knowledge_graph_in_session_state():
    """
    Tests that the .graph attribute of a KnowledgeGraph object stored in 
    a dictionary (simulating st.session_state) is correctly updated.
    """
    # Arrange:
    # 1. Create a dictionary to simulate st.session_state
    mock_session_state = {}

    # 2. Create an instance of KnowledgeGraph
    # For this test, KnowledgeGraph's own __init__ complexity is not an issue,
    # as we are testing the mutability of its 'graph' attribute after instantiation.
    kg_obj = KnowledgeGraph(name='TestKG')
    assert kg_obj.graph is not None # Initial graph should exist (empty or default)
    initial_graph_id = id(kg_obj.graph)


    # 3. Put this kg_obj into the mock session state
    mock_session_state['knowledge_graph_instance'] = kg_obj

    # 4. Create a sample nx.Graph
    sample_nx_graph = nx.Graph()
    sample_nx_graph.add_edge("nodeA", "nodeB", weight=0.5)
    sample_nx_graph.add_node("nodeC", color="red")
    
    # Act:
    # Simulate the core logic from ui/app.py that updates the graph.
    # This logic would typically be:
    #   kg_instance_from_session = st.session_state['knowledge_graph_instance']
    #   kg_instance_from_session.graph = new_networkx_graph
    
    # Simulate retrieval and update:
    retrieved_kg_instance = mock_session_state['knowledge_graph_instance']
    retrieved_kg_instance.graph = sample_nx_graph # Assign the new graph object

    # Assert:
    # 1. Verify that the graph attribute of the KnowledgeGraph object in mock_session_state
    #    now refers to the new sample_nx_graph.
    assert mock_session_state['knowledge_graph_instance'].graph is sample_nx_graph
    assert id(mock_session_state['knowledge_graph_instance'].graph) != initial_graph_id

    # 2. Verify that the graph attribute of the original kg_obj (which is the same object
    #    as the one in mock_session_state due to reference semantics) has also been updated.
    assert kg_obj.graph is sample_nx_graph
    assert id(kg_obj.graph) != initial_graph_id

    # 3. Check some properties of the new graph to be sure
    assert len(mock_session_state['knowledge_graph_instance'].graph.nodes()) == 3
    assert mock_session_state['knowledge_graph_instance'].graph.has_edge("nodeA", "nodeB")
    assert mock_session_state['knowledge_graph_instance'].graph.nodes["nodeC"]["color"] == "red"

    # 4. Ensure the object in session state is indeed the same one we started with
    assert mock_session_state['knowledge_graph_instance'] is kg_obj


# Example of how this test relates to ui/app.py's "Show Semantic Graph" logic:
#
# In ui/app.py (simplified):
#
#   # (semantic_graph_obj is a new nx.Graph created by analysis_service)
#   if 'knowledge_graph_instance' in st.session_state and st.session_state['knowledge_graph_instance'] is not None:
#       kg_instance = st.session_state['knowledge_graph_instance'] # Retrieve
#       kg_instance.graph = semantic_graph_obj  # Update attribute
#       kg_instance.nodes = {} # Example of other attribute updates
#       kg_instance.edges = {} # Example of other attribute updates
#
# This test verifies the core part: `kg_instance.graph = semantic_graph_obj`
# correctly updates the graph on the shared KnowledgeGraph object.
# It does not need to mock st.write or other Streamlit UI functions from app.py.
# It also doesn't mock the KnowledgeGraph class itself, using the actual class to ensure
# its mutability is as expected.
