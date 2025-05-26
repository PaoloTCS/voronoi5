import pandas as pd
from models.document import Document # Ensure this path is correct based on project structure
from typing import List, Any, Dict, Union, IO
import io

def process_csv_dataframe_to_documents(
    df: pd.DataFrame, 
    selected_columns: List[str], 
    csv_filename: str,
    existing_doc_titles: set = None 
) -> List[Document]:
    """
    Processes a pandas DataFrame (from a CSV) into a list of Document objects.

    Args:
        df: The pandas DataFrame to process.
        selected_columns: A list of strings representing the column headers to be processed.
        csv_filename: The original name of the CSV file (for generating document titles).
        existing_doc_titles: An optional set of existing document titles to ensure
                             that newly generated titles are unique.

    Returns:
        A list of Document objects.
    """
    if existing_doc_titles is None:
        existing_doc_titles = set()

    new_documents: List[Document] = []
        
    for index, row in df.iterrows():
        content_list = []
        for col in selected_columns:
            if col in row and pd.notna(row[col]):
                content_list.append(str(row[col]))
        
        content = " | ".join(content_list)

        if content:
            doc_title_base = f"{csv_filename}_Row{index + 1}"
            final_doc_title = doc_title_base
            
            counter = 1
            while final_doc_title in existing_doc_titles:
                final_doc_title = f"{doc_title_base}_{counter}"
                counter += 1
            existing_doc_titles.add(final_doc_title)

            metadata = {
                'source': 'csv',
                'original_filename': csv_filename,
                'row_index': index,
                'selected_columns': selected_columns
            }
            
            new_doc = Document(
                title=final_doc_title,
                content=content,
                metadata=metadata
            )
            new_documents.append(new_doc)
            
    return new_documents


# --- Kept the original function for file objects, can be deprecated or used if needed ---
def process_csv_file_to_documents(
    file_obj: IO[Any], 
    selected_columns: List[str], 
    csv_filename: str,
    existing_doc_titles: set = None
) -> List[Document]:
    """
    Processes a CSV file object into a list of Document objects.
    This function now calls process_csv_dataframe_to_documents.
    """
    try:
        df = pd.read_csv(file_obj)
    except Exception as e:
        print(f"Error reading CSV file '{csv_filename}': {e}")
        raise 
        
    return process_csv_dataframe_to_documents(df, selected_columns, csv_filename, existing_doc_titles)


# Example Usage (can be run directly for testing this module if needed)
if __name__ == '__main__':
    sample_csv_data_str = "Header1,Header2,Header3\nval1A,val1B,val1C\nval2A,val2B,val2C\n,val3B,val3C"
    
    # Test with DataFrame input
    print("--- Testing with DataFrame input ---")
    sample_df = pd.read_csv(io.StringIO(sample_csv_data_str))
    selected_cols_df = ["Header1", "Header2"]
    filename_df = "my_test_df.csv"
    existing_titles_df = {"my_test_df.csv_Row1"}

    try:
        documents_from_df = process_csv_dataframe_to_documents(sample_df, selected_cols_df, filename_df, existing_titles_df)
        if documents_from_df:
            print(f"Successfully processed {len(documents_from_df)} documents from DataFrame:")
            for doc in documents_from_df:
                print(f"  Title: {doc.title}, Content: \"{doc.content}\", Metadata: {doc.metadata}")
        else:
            print("No documents were processed from the DataFrame.")
    except Exception as e:
        print(f"Error during DataFrame example usage: {e}")

    print("\n--- Testing with file object input (via process_csv_file_to_documents) ---")
    mock_file_obj = io.StringIO(sample_csv_data_str)
    selected_cols_file = ["Header2", "Header3"]
    filename_file = "my_test_file.csv"
    try:
        documents_from_file = process_csv_file_to_documents(mock_file_obj, selected_cols_file, filename_file)
        if documents_from_file:
            print(f"Successfully processed {len(documents_from_file)} documents from file object:")
            for doc in documents_from_file:
                print(f"  Title: {doc.title}, Content: \"{doc.content}\", Metadata: {doc.metadata}")
        else:
            print("No documents were processed from the file object.")
    except Exception as e:
        print(f"Error during file object example usage: {e}")
