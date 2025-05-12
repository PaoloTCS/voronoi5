import streamlit as st

# --- Layout Setup ---
st.set_page_config(layout="wide")

# --- Top-level columns: Left Sidebar, Main Area, Right Breadcrumb ---
left_col, main_col, right_col = st.columns([1, 6, 1])

with left_col:
    st.image("https://upload.wikimedia.org/wikipedia/commons/3/3f/Logo_placeholder.png", width=80)  # Placeholder logo
    st.markdown("### Document Loading")
    st.button("Upload Document")
    st.button("View Documents")
    st.markdown("---")
    st.write("Other sidebar tools...")

with right_col:
    st.markdown("### Breadcrumb")
    st.markdown("> Home / Processing / Path Encoding")
    st.write("Step 3 of 4")
    st.markdown("---")
    st.write("Other navigation...")

with main_col:
    st.markdown("# Voronoi (Main)")
    st.write("This is the main workspace area for visualization, analysis, etc.")
    st.markdown("⬆️ Main output appears here.")

# --- Bottom Navigation Bar (simulated with columns) ---
st.markdown("---")
bottom1, bottom2, bottom3, bottom4 = st.columns([2, 2, 2, 2])
with bottom1:
    st.button("Document Loading")
with bottom2:
    st.button("Processing")
with bottom3:
    st.button("Path Encoding")
with bottom4:
    st.button("Breadcrumb Navigation")

st.markdown("#### (This is a mockup of your sketched layout. All buttons are placeholders.)") 