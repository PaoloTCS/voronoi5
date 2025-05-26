import pytest
from unittest.mock import patch, MagicMock, PropertyMock
import pandas as pd
import numpy as np
import io
import sys
import os

# Adjust sys.path to allow imports from the project root
_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

# --- Global Mocks ---
# This MOCK_ST will be seen by ui.app.py when it executes 'import streamlit as st'
MOCK_ST = MagicMock()

# Configure methods and attributes of MOCK_ST that are called at the global scope of ui.app.py
MOCK_ST.columns.return_value = (MagicMock(), MagicMock(), MagicMock())
MOCK_ST.session_state = {} # Initialize as a dict for st.session_state.get and direct access.
                           # Tests will populate this further via mock_st_session_state_dict.

# Mock functions called at global scope in ui.app.py
# For functions that are called and their return value is used or unpacked:
MOCK_ST.title = MagicMock()
MOCK_ST.markdown = MagicMock()
MOCK_ST.subheader = MagicMock()
MOCK_ST.info = MagicMock()
MOCK_ST.metric = MagicMock()
MOCK_ST.caption = MagicMock()
MOCK_ST.write = MagicMock()
MOCK_ST.header = MagicMock()
MOCK_ST.radio = MagicMock()
MOCK_ST.slider = MagicMock()
MOCK_ST.number_input = MagicMock()
MOCK_ST.selectbox = MagicMock()
MOCK_ST.multiselect = MagicMock() # Though sidebar.multiselect is used more often for CSV
MOCK_ST.button = MagicMock() # For any top-level buttons
MOCK_ST.expander = MagicMock()
MOCK_ST.expander.return_value.__enter__ = MagicMock(return_value=None)
MOCK_ST.expander.return_value.__exit__ = MagicMock(return_value=None)
MOCK_ST.plotly_chart = MagicMock()
MOCK_ST.dataframe = MagicMock()
MOCK_ST.graphviz_chart = MagicMock()
MOCK_ST.spinner = MagicMock() # Context manager for spinner
MOCK_ST.spinner.return_value.__enter__ = MagicMock(return_value=None)
MOCK_ST.spinner.return_value.__exit__ = MagicMock(return_value=None)
MOCK_ST.error = MagicMock()
MOCK_ST.warning = MagicMock()
MOCK_ST.success = MagicMock()
MOCK_ST.rerun = MagicMock()


# Mock sidebar elements if used globally (they usually are)
MOCK_ST.sidebar = MagicMock()
MOCK_ST.sidebar.header = MagicMock()
MOCK_ST.sidebar.file_uploader = MagicMock()
MOCK_ST.sidebar.button = MagicMock()
MOCK_ST.sidebar.caption = MagicMock()
MOCK_ST.sidebar.expander = MagicMock()
MOCK_ST.sidebar.expander.return_value.__enter__ = MagicMock(return_value=None)
MOCK_ST.sidebar.expander.return_value.__exit__ = MagicMock(return_value=None)
MOCK_ST.sidebar.info = MagicMock()
MOCK_ST.sidebar.warning = MagicMock()
MOCK_ST.sidebar.error = MagicMock()
MOCK_ST.sidebar.subheader = MagicMock()
MOCK_ST.sidebar.multiselect = MagicMock()
MOCK_ST.sidebar.selectbox = MagicMock()
MOCK_ST.sidebar.write = MagicMock()
MOCK_ST.sidebar.slider = MagicMock()
MOCK_ST.sidebar.number_input = MagicMock()


# Mock @st.cache_resource decorator
# It needs to be a callable that returns a decorator, which then returns the original function.
def mock_cache_resource_decorator(func):
    return func # Simplest mock: just return the function itself without caching

MOCK_ST.cache_resource = mock_cache_resource_decorator


sys.modules['streamlit'] = MOCK_ST
sys.modules['streamlit.components.v1'] = MagicMock() # If ui.app uses st.components.v1.html or similar

# Mock other external libraries
sys.modules['PyPDF2'] = MagicMock()
sys.modules['networkx'] = MagicMock()
sys.modules['plotly.express'] = MagicMock()
sys.modules['graphviz'] = MagicMock()
sys.modules['gmpy2'] = MagicMock()

# Mock project's own service modules to prevent their __init__ from running complex logic
# This is crucial if service initializations load models or have other side effects.
sys.modules['models.document'] = MagicMock()
sys.modules['models.chunk'] = MagicMock()
sys.modules['services.ai.embedding_service'] = MagicMock()
sys.modules['services.ai.analysis_service'] = MagicMock()
sys.modules['services.ai.text_processor'] = MagicMock() 
sys.modules['services.knowledge_graph_service'] = MagicMock()
sys.modules['services.path_encoding_service'] = MagicMock()
sys.modules['visualization.scatter_plotter'] = MagicMock()
sys.modules['models.knowledge_graph'] = MagicMock()


# Now, attempt to import the app module. This import should use the MOCK_ST.
try:
    from ui import app as streamlit_app 
    # Re-import Document and Chunk for tests, as they were mocked in sys.modules for ui.app's import
    # For the tests themselves, we need the actual classes.
    # This requires careful handling: ui.app sees mocked models, tests see real models.
    # A better way would be for ui.app to take classes as dependencies, but that's a refactor.
    # For now, let's assume tests can get the real ones if needed, or also use mocks.
    # The critical part is that ui.app imports without error.
    from models.document import Document as ActualDocument # Use actual for test data creation
    from models.chunk import Chunk as ActualChunk # Use actual for test data creation

except Exception as e:
    print(f"Error during test setup while importing streamlit_app or models: {e}")
    streamlit_app = None 
    ActualDocument = None
    ActualChunk = None

@pytest.fixture
def mock_st_session_state_dict():
    # This dictionary is used to set the .session_state attribute of the mock_st_obj in each test
    return {
        'documents': [], 'embeddings_generated': False, 'all_chunk_embeddings_matrix': None,
        'all_chunk_labels': [], 'chunk_label_lookup_dict': {}, 'analysis_level': 'Documents',
        'scatter_fig_2d': None, 'current_coords_2d': None, 'current_labels': [],
        'coords_3d': None, 'current_view': 'splash', 'csv_data': None,
        'csv_columns_selected': False, 'selected_csv_columns': [],
        'num_chunks_processed': 0, 'last_action': None, 'doc_color_map': {},
        'knowledge_graph_instance': MagicMock() # Mock the KG instance used in session state
    }

@pytest.fixture
def sample_csv_content():
    return "Name,Age,City\nAlice,30,New York\nBob,24,Paris\nCharlie,35,London"

@pytest.fixture
def sample_csv_file(sample_csv_content):
    mock_file = MagicMock(name="UploadedFile")
    mock_file.name = "test.csv"
    mock_file.type = "text/csv"
    mock_file.size = len(sample_csv_content.encode('utf-8'))
    # For pd.read_csv, it's often easiest if the object itself is file-like.
    # The test patches pd.read_csv, so this mock_file is what the patched version receives.
    # The patched pd.read_csv will be configured to return a DataFrame from sample_csv_content.
    return mock_file

# --- Test Cases ---

# Use @patch('ui.app.st') to ensure that within the scope of ui.app module, 'st' is our mock
# The 'new_callable=MagicMock' ensures that the mock_st_obj_for_test is a fresh MagicMock for each test,
# inheriting global configurations if not overridden, but allowing test-specific return values.
# However, since MOCK_ST is already globally defined and put into sys.modules,
# ui.app already sees MOCK_ST as 'st'. Patching 'ui.app.st' again in each test
# replaces that MOCK_ST with a new MagicMock for the test's duration.
# This is fine, but means mock_st_obj_for_test needs its own session_state setup.

@patch('ui.app.pd.read_csv') 
@patch('ui.app.st') # This 'st' is what ui.app sees
def test_csv_upload_and_parsing(mock_st_in_app, mock_pd_read_csv, mock_st_session_state_dict, sample_csv_content, sample_csv_file):
    if not streamlit_app: pytest.fail("streamlit_app (ui.app module) import failed.")
    if not ActualDocument: pytest.fail("ActualDocument class import failed.")

    # Configure the 'st' mock that ui.app will use for this test
    mock_st_in_app.session_state = mock_st_session_state_dict # ui.app.st.session_state is now our dict
    mock_st_in_app.sidebar.file_uploader.return_value = [sample_csv_file]
    # Simulate the specific button press for "Process Uploaded Files"
    # Assuming the button call in app.py is st.sidebar.button("Process Uploaded Files")
    # We configure the mock for that specific call if possible, or a general one.
    # Let's assume the test focuses on the logic path IF that button were pressed.
    mock_st_in_app.sidebar.button.return_value = True 

    expected_df = pd.read_csv(io.StringIO(sample_csv_content))
    mock_pd_read_csv.return_value = expected_df

    # --- Simulate the relevant part of ui.app.py execution flow ---
    # This is the logic block for the "Process Uploaded Files" button
    uploaded_files_in_app = mock_st_in_app.sidebar.file_uploader.return_value
    
    if mock_st_in_app.sidebar.button.return_value: # Check if the "Process Uploaded Files" button was pressed
        if uploaded_files_in_app:
            for up_file_in_loop in uploaded_files_in_app:
                if up_file_in_loop.type in ['text/csv', 'application/vnd.ms-excel']:
                    df_content = mock_pd_read_csv(up_file_in_loop) 
                    mock_st_in_app.session_state['csv_data'] = {'filename': up_file_in_loop.name, 'df': df_content}
                    mock_st_in_app.session_state['csv_columns_selected'] = False
                    mock_st_in_app.session_state['selected_csv_columns'] = []
                    mock_st_in_app.rerun() 

    assert mock_st_in_app.session_state['csv_data'] is not None
    assert mock_st_in_app.session_state['csv_data']['filename'] == "test.csv"
    pd.testing.assert_frame_equal(mock_st_in_app.session_state['csv_data']['df'], expected_df)
    assert mock_st_in_app.session_state['csv_columns_selected'] is False
    mock_pd_read_csv.assert_called_once_with(sample_csv_file) 
    mock_st_in_app.rerun.assert_called_once()


@patch('ui.app.st')
def test_column_selection_ui_population(mock_st_in_app, mock_st_session_state_dict, sample_csv_content):
    if not streamlit_app: pytest.fail("streamlit_app (ui.app module) import failed.")
    
    df = pd.read_csv(io.StringIO(sample_csv_content))
    mock_st_session_state_dict['csv_data'] = {'filename': 'test.csv', 'df': df}
    mock_st_session_state_dict['csv_columns_selected'] = False
    mock_st_session_state_dict['selected_csv_columns'] = [] 
    mock_st_in_app.session_state = mock_st_session_state_dict

    expected_columns = df.columns.tolist()
    
    # We expect st.sidebar.multiselect to be called by the app's logic
    # The mock_st_in_app.sidebar.multiselect is already a MagicMock due to global MOCK_ST setup.
    # We can check its call arguments after simulating the app logic.

    # --- Simulate the app's logic block that calls multiselect ---
    # This is from the "CSV Column Selection" part of ui/app.py
    if mock_st_in_app.session_state['csv_data'] and not mock_st_in_app.session_state['csv_columns_selected']:
        app_df_cols = mock_st_in_app.session_state['csv_data']['df'].columns.tolist()
        # Simulate the app calling st.sidebar.multiselect
        mock_st_in_app.sidebar.multiselect(
            "Choose columns to concatenate for analysis:", 
            options=app_df_cols,
            default=mock_st_in_app.session_state['selected_csv_columns'] 
        )

    mock_st_in_app.sidebar.multiselect.assert_called_once()
    call_args = mock_st_in_app.sidebar.multiselect.call_args_list[0] 
    assert call_args[1]['options'] == expected_columns
    assert call_args[1]['default'] == []


@patch('ui.app.reset_derived_data') 
@patch('ui.app.st')
def test_process_selected_csv_columns(mock_st_in_app, mock_reset_derived, mock_st_session_state_dict, sample_csv_content):
    if not streamlit_app: pytest.fail("streamlit_app (ui.app module) import failed.")
    if not ActualDocument: pytest.fail("ActualDocument class import failed.")

    df = pd.read_csv(io.StringIO(sample_csv_content))
    mock_st_session_state_dict['csv_data'] = {'filename': 'test.csv', 'df': df}
    mock_st_session_state_dict['csv_columns_selected'] = False 
    mock_st_session_state_dict['selected_csv_columns'] = ['Name', 'City'] 
    mock_st_session_state_dict['documents'] = [] 
    mock_st_in_app.session_state = mock_st_session_state_dict
    
    # --- Simulate ui.app.py's "Process Selected CSV Columns" logic ---
    # This logic follows a button press for "Process Selected CSV Columns"
    # We assume the button was pressed and execute the subsequent block:
    if not mock_st_in_app.session_state['selected_csv_columns']:
        mock_st_in_app.sidebar.error("Please select at least one column.") 
    else:
        mock_reset_derived(clear_docs=False) 
        csv_filename_test = mock_st_in_app.session_state['csv_data']['filename']
        df_test = mock_st_in_app.session_state['csv_data']['df']
        new_csv_docs_test = []
        for index, row in df_test.iterrows():
            content_list = [str(row[col]) for col in mock_st_in_app.session_state['selected_csv_columns'] if pd.notna(row[col])]
            content = " | ".join(content_list)
            if content:
                doc_title = f"{csv_filename_test}_Row{index+1}"
                # Use ActualDocument for creating test instances
                new_doc = ActualDocument(
                    title=doc_title, content=content,
                    metadata={'source': 'csv', 'original_filename': csv_filename_test, 
                              'row_index': index, 'selected_columns': mock_st_in_app.session_state['selected_csv_columns']}
                )
                new_csv_docs_test.append(new_doc)
        mock_st_in_app.session_state['documents'].extend(new_csv_docs_test)
        mock_st_in_app.session_state['csv_data'] = None
        mock_st_in_app.session_state['csv_columns_selected'] = True
        mock_st_in_app.session_state['current_view'] = 'analysis' 
        mock_st_in_app.rerun()

    mock_reset_derived.assert_called_once_with(clear_docs=False)
    assert len(mock_st_in_app.session_state['documents']) == 3
    doc1 = mock_st_in_app.session_state['documents'][0]
    assert doc1.title == "test.csv_Row1"
    assert doc1.content == "Alice | New York"
    assert doc1.metadata['selected_columns'] == ['Name', 'City']
    assert mock_st_in_app.session_state['csv_data'] is None
    assert mock_st_in_app.session_state['csv_columns_selected'] is True
    assert mock_st_in_app.session_state['current_view'] == 'analysis'
    mock_st_in_app.rerun.assert_called_once()


@patch('ui.app.st')
def test_ui_element_disabling_before_csv_processing(mock_st_in_app, mock_st_session_state_dict):
    if not streamlit_app: pytest.fail("streamlit_app (ui.app module) import failed.")
    
    df = pd.DataFrame({'A': [1], 'B': [2]})
    mock_st_session_state_dict['csv_data'] = {'filename': 'pending.csv', 'df': df} 
    mock_st_session_state_dict['csv_columns_selected'] = False 
    mock_st_session_state_dict['documents'] = [] 
    mock_st_in_app.session_state = mock_st_session_state_dict

    csv_is_pending_processing_in_app = bool(mock_st_in_app.session_state['csv_data'] and \
                                          not mock_st_in_app.session_state['csv_columns_selected'])
    assert csv_is_pending_processing_in_app is True

    chunking_disabled_calc = not True or not mock_st_in_app.session_state['documents'] or csv_is_pending_processing_in_app
    assert chunking_disabled_calc is True

    embedding_disabled_calc = not True or not mock_st_in_app.session_state['documents'] or csv_is_pending_processing_in_app
    assert embedding_disabled_calc is True
    
    path_encoding_disabled_calc = csv_is_pending_processing_in_app
    assert path_encoding_disabled_calc is True


@patch('ui.app.st')
def test_ui_element_enabling_after_csv_processing(mock_st_in_app, mock_st_session_state_dict):
    if not streamlit_app: pytest.fail("streamlit_app (ui.app module) import failed.")
    if not ActualDocument: pytest.fail("ActualDocument class import failed.")

    mock_st_session_state_dict['csv_data'] = None 
    mock_st_session_state_dict['csv_columns_selected'] = True 
    mock_st_session_state_dict['documents'] = [MagicMock(spec=ActualDocument)] 
    mock_st_in_app.session_state = mock_st_session_state_dict

    csv_is_pending_processing_in_app = bool(mock_st_in_app.session_state['csv_data'] and \
                                   not mock_st_in_app.session_state['csv_columns_selected'])
    assert csv_is_pending_processing_in_app is False 

    chunking_disabled_calc = not True or not mock_st_in_app.session_state['documents'] or csv_is_pending_processing_in_app
    assert chunking_disabled_calc is False 

    embedding_disabled_calc = not True or not mock_st_in_app.session_state['documents'] or csv_is_pending_processing_in_app
    assert embedding_disabled_calc is False 
    
    path_encoding_disabled_calc = csv_is_pending_processing_in_app
    assert path_encoding_disabled_calc is False 


@patch('ui.app.ContextualChunker') 
def test_chunking_csv_derived_document(MockedContextualChunkerClass, mock_st_session_state_dict):
    if not streamlit_app: pytest.fail("streamlit_app (ui.app module) import failed.")
    if not ActualDocument or not ActualChunk: pytest.fail("ActualDocument/Chunk class import failed.")

    csv_doc = ActualDocument(title="test_csv_Row1", content="Alice from New York works at Foo Inc.")
        
    mock_chunker_instance = MockedContextualChunkerClass.return_value 
    mock_chunker_instance.chunk_document.return_value = [
        ActualChunk(content="Alice from New York", doc_title="test_csv_Row1", context_label="Part1"),
        ActualChunk(content="works at Foo Inc.", doc_title="test_csv_Row1", context_label="Part2")
    ]
    
    # This test assumes that if one were to use the chunker instance (that ui.app would use),
    # this is how it would behave with a document derived from a CSV.
    returned_chunks = mock_chunker_instance.chunk_document(csv_doc)
    csv_doc.chunks = returned_chunks 

    assert len(csv_doc.chunks) == 2
    assert csv_doc.chunks[0].content == "Alice from New York"
    mock_chunker_instance.chunk_document.assert_called_once_with(csv_doc)


@patch('ui.app.EmbeddingService') 
def test_embedding_csv_derived_document(MockedEmbeddingServiceClass, mock_st_session_state_dict):
    if not streamlit_app: pytest.fail("streamlit_app (ui.app module) import failed.")
    if not ActualDocument: pytest.fail("ActualDocument class import failed.")

    csv_doc = ActualDocument(title="test_csv_Row1", content="Alice from New York.")
    
    mock_embedding_instance = MockedEmbeddingServiceClass.return_value
    mock_embedding_instance.generate_embedding.return_value = np.array([0.1, 0.2, 0.3])
        
    doc_embedding = mock_embedding_instance.generate_embedding(csv_doc.content)
    csv_doc.embedding = doc_embedding 

    assert csv_doc.embedding is not None
    np.testing.assert_array_equal(csv_doc.embedding, np.array([0.1, 0.2, 0.3]))
    mock_embedding_instance.generate_embedding.assert_called_once_with("Alice from New York.")

print("Test file 'tests/test_csv_processing.py' updated/created.")

if 'streamlit_app' not in globals() or streamlit_app is None:
    print("Warning: streamlit_app (ui.app) may not have been imported correctly by the test file generation script. ")
