import pytest
import pandas as pd
import io # For creating file-like objects from strings for pd.read_csv in tests
import sys
import os

# Adjust sys.path to allow imports from the project root
_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from models.document import Document
from services.csv_processor import process_csv_dataframe_to_documents

# --- Test Fixtures ---

@pytest.fixture
def sample_dataframe_1():
    """A basic sample DataFrame."""
    data = {
        'ID': [1, 2, 3],
        'Name': ['Alice', 'Bob', 'Charlie'],
        'Role': ['Engineer', 'Artist', 'Manager'],
        'Comment': ['Loves Python', 'Paints murals', 'Oversees projects']
    }
    return pd.DataFrame(data)

@pytest.fixture
def sample_dataframe_with_nan():
    """A DataFrame with some NaN values."""
    data = {
        'ColA': ['DataA1', None, 'DataA3', 'DataA4'],
        'ColB': ['DataB1', 'DataB2', None, 'DataB4'],
        'ColC': [None, None, None, 'DataC4']
    }
    return pd.DataFrame(data)

@pytest.fixture
def empty_dataframe():
    """An empty DataFrame."""
    return pd.DataFrame()

# --- Test Cases for process_csv_dataframe_to_documents ---

def test_basic_case(sample_dataframe_1):
    df = sample_dataframe_1
    selected_columns = ['Name', 'Role']
    csv_filename = "employees.csv"
    
    documents = process_csv_dataframe_to_documents(df, selected_columns, csv_filename)
    
    assert len(documents) == 3
    
    # Document 1
    doc1 = documents[0]
    assert doc1.title == "employees.csv_Row1"
    assert doc1.content == "Alice | Engineer"
    assert doc1.metadata['source'] == 'csv'
    assert doc1.metadata['original_filename'] == csv_filename
    assert doc1.metadata['row_index'] == 0
    assert doc1.metadata['selected_columns'] == selected_columns
    
    # Document 2
    doc2 = documents[1]
    assert doc2.title == "employees.csv_Row2"
    assert doc2.content == "Bob | Artist"
    
    # Document 3
    doc3 = documents[2]
    assert doc3.title == "employees.csv_Row3"
    assert doc3.content == "Charlie | Manager"

def test_column_selection_single(sample_dataframe_1):
    df = sample_dataframe_1
    selected_columns = ['Name']
    csv_filename = "names.csv"
    documents = process_csv_dataframe_to_documents(df, selected_columns, csv_filename)
    assert len(documents) == 3
    assert documents[0].content == "Alice"
    assert documents[1].content == "Bob"
    assert documents[2].content == "Charlie"

def test_column_selection_all(sample_dataframe_1):
    df = sample_dataframe_1
    selected_columns = ['ID', 'Name', 'Role', 'Comment'] # All columns
    csv_filename = "full_data.csv"
    documents = process_csv_dataframe_to_documents(df, selected_columns, csv_filename)
    assert len(documents) == 3
    # Convert ID to string as all values are stringified by the function
    assert documents[0].content == "1 | Alice | Engineer | Loves Python"
    assert documents[1].content == "2 | Bob | Artist | Paints murals"
    assert documents[2].content == "3 | Charlie | Manager | Oversees projects"

def test_empty_dataframe(empty_dataframe):
    df = empty_dataframe
    selected_columns = ['A', 'B'] # Does not matter if DF is empty
    csv_filename = "empty.csv"
    documents = process_csv_dataframe_to_documents(df, selected_columns, csv_filename)
    assert len(documents) == 0

def test_no_selected_columns(sample_dataframe_1):
    df = sample_dataframe_1
    selected_columns = [] # No columns selected
    csv_filename = "no_selection.csv"
    documents = process_csv_dataframe_to_documents(df, selected_columns, csv_filename)
    
    # Expect no documents to be created, as content will be empty string and filtered by `if content:`
    assert len(documents) == 0

def test_dataframe_with_nan_values(sample_dataframe_with_nan):
    df = sample_dataframe_with_nan
    selected_columns = ['ColA', 'ColB', 'ColC']
    csv_filename = "nan_test.csv"
    
    documents = process_csv_dataframe_to_documents(df, selected_columns, csv_filename)
    
    assert len(documents) == 4 # 4 rows in the DataFrame
    
    # Expected content (NaNs are skipped by pd.notna, so they don't appear as "nan" string)
    # Row 0: DataA1 | DataB1
    # Row 1: DataB2
    # Row 2: DataA3 
    # Row 3: DataA4 | DataB4 | DataC4
    
    assert documents[0].content == "DataA1 | DataB1" 
    assert documents[0].metadata['row_index'] == 0
    
    assert documents[1].content == "DataB2" # ColA and ColC are NaN
    assert documents[1].metadata['row_index'] == 1
    
    assert documents[2].content == "DataA3" # ColB and ColC are NaN
    assert documents[2].metadata['row_index'] == 2

    assert documents[3].content == "DataA4 | DataB4 | DataC4"
    assert documents[3].metadata['row_index'] == 3

def test_nan_in_all_selected_columns_for_a_row():
    data = {'ColX': [1, None, 3], 'ColY': ['A', None, 'C']}
    df = pd.DataFrame(data)
    selected_columns = ['ColY'] # Select ColY, which has a None in the middle
    csv_filename = "nan_row.csv"
    documents = process_csv_dataframe_to_documents(df, selected_columns, csv_filename)
    
    # Row 0: "A"
    # Row 1: "" (content is None, so document might not be created if content is empty string and filtered)
    # Row 2: "C"
    # The current implementation creates a document if content is not empty string.
    # pd.notna(row[col]) filters out NaNs. If all selected cols for a row are NaN, content_list is empty, content is "".
    # The `if content:` check means such rows won't produce a Document.
    
    assert len(documents) == 2 # Row 1 (index 1) should be skipped
    assert documents[0].content == "A"
    assert documents[0].title == "nan_row.csv_Row1"
    assert documents[1].content == "C"
    assert documents[1].title == "nan_row.csv_Row3" # Note: Title uses original DataFrame index + 1

def test_filename_handling(sample_dataframe_1):
    df = sample_dataframe_1.head(1) # Just one row for simplicity
    selected_columns = ['Name']
    csv_filename = "specific_filename.csv"
    
    documents = process_csv_dataframe_to_documents(df, selected_columns, csv_filename)
    
    assert len(documents) == 1
    doc = documents[0]
    assert doc.title == "specific_filename.csv_Row1"
    assert doc.metadata['original_filename'] == "specific_filename.csv"

def test_title_uniqueness(sample_dataframe_1):
    df = sample_dataframe_1
    selected_columns = ['Name']
    csv_filename = "unique_titles.csv"
    
    # Simulate some existing titles
    existing_titles = {
        "unique_titles.csv_Row1", # Conflict with the first document
        "unique_titles.csv_Row2_1" # Potential conflict if not handled carefully
    }
    
    documents = process_csv_dataframe_to_documents(df, selected_columns, csv_filename, existing_titles)
    
    assert len(documents) == 3
    
    # Titles should be unique
    doc_titles = [doc.title for doc in documents]
    assert len(doc_titles) == len(set(doc_titles)) # All generated titles are unique among themselves
    
    # Check specific titles based on conflict resolution
    # Doc1 (original: unique_titles.csv_Row1) should now be unique_titles.csv_Row1_1
    # Doc2 (original: unique_titles.csv_Row2) should be unique_titles.csv_Row2
    # Doc3 (original: unique_titles.csv_Row3) should be unique_titles.csv_Row3
    
    # The existing_titles set is modified in-place by the function.
    # Let's check the generated titles against the initial state of existing_titles.
    
    # Initial existing_titles for checking:
    initial_existing_titles = {
        "unique_titles.csv_Row1", 
        "unique_titles.csv_Row2_1" 
    }

    assert documents[0].title not in initial_existing_titles 
    assert documents[0].title == "unique_titles.csv_Row1_1" # First conflict
    
    # Second document's base title is "unique_titles.csv_Row2".
    # It does not conflict with "unique_titles.csv_Row1" or "unique_titles.csv_Row2_1".
    assert documents[1].title == "unique_titles.csv_Row2" 
    
    # Third document's base title is "unique_titles.csv_Row3".
    assert documents[2].title == "unique_titles.csv_Row3"

def test_title_uniqueness_multiple_conflicts(sample_dataframe_1):
    # Test scenario where base title and _1 are already taken
    df = sample_dataframe_1.head(1) # Only one row needed
    selected_columns = ['Name']
    csv_filename = "conflict.csv"
    
    existing_titles = {
        "conflict.csv_Row1",    # Base title taken
        "conflict.csv_Row1_1"   # Title with _1 suffix taken
    }
    
    documents = process_csv_dataframe_to_documents(df, selected_columns, csv_filename, existing_titles)
    
    assert len(documents) == 1
    # Expected title: conflict.csv_Row1_2
    assert documents[0].title == "conflict.csv_Row1_2"


def test_all_columns_empty_strings_or_nan(sample_dataframe_with_nan):
    # Modify dataframe so one row has only NaN or empty strings for selected columns
    df = sample_dataframe_with_nan.copy()
    # Row index 1 for ColB is 'DataB2'. Let's make it NaN. ColA is already None. ColC is None.
    df.loc[1, 'ColB'] = None 
    # Now row 1 has (None, None, None) for (ColA, ColB, ColC)

    selected_columns = ['ColA', 'ColB', 'ColC']
    csv_filename = "all_nan_row.csv"
    
    documents = process_csv_dataframe_to_documents(df, selected_columns, csv_filename)
    
    # Row 0: DataA1 | DataB1 (original ColB was DataB1)
    # Row 1: (content will be empty string, so this document should be skipped)
    # Row 2: DataA3
    # Row 3: DataA4 | DataB4 | DataC4
    
    # Expected number of documents: 3 (original row 1 is now skipped)
    assert len(documents) == 3 
    
    doc_titles = [doc.title for doc in documents]
    assert "all_nan_row.csv_Row2" not in doc_titles # Row at index 1 (title _Row2) should be skipped

    assert documents[0].content == "DataA1 | DataB1" # Original df had DataB1 for row 0
    assert documents[0].metadata['row_index'] == 0
    
    # Document corresponding to original row index 2 (now at index 1 in `documents` list)
    assert documents[1].content == "DataA3" 
    assert documents[1].metadata['row_index'] == 2

    # Document corresponding to original row index 3 (now at index 2 in `documents` list)
    assert documents[2].content == "DataA4 | DataB4 | DataC4"
    assert documents[2].metadata['row_index'] == 3
