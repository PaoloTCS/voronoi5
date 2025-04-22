/**
 * Document model
 * Represents a document with content and semantic properties
 */

import { generateEmbedding } from '../semantic/embeddingService';

class Document {
  /**
   * Create a new document
   * @param {Object} options - Document options
   * @param {string} options.id - Unique identifier
   * @param {string} options.title - Document title
   * @param {string} options.content - Document content
   * @param {Object} options.metadata - Additional metadata
   */
  constructor({ id, title, content, metadata = {} }) {
    this.id = id || `doc-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    this.title = title || 'Untitled Document';
    this.content = content || '';
    this.metadata = metadata;
    this.embedding = null;
  }

  /**
   * Generate or retrieve the document's semantic embedding
   * @returns {Array} - Embedding vector
   */
  getEmbedding() {
    if (!this.embedding) {
      this.embedding = generateEmbedding(this);
    }
    return this.embedding;
  }

  /**
   * Get keywords from the document content
   * @param {number} count - Maximum number of keywords to return
   * @returns {Array} - Keywords with scores
   */
  getKeywords(count = 10) {
    // Simple keyword extraction based on frequency
    // In a real implementation, use TF-IDF or a specialized NLP library
    const words = this.content.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);
      
    const stopWords = [
      'this', 'that', 'then', 'than', 'they', 'them', 'those', 'these', 
      'with', 'from', 'have', 'what', 'when', 'where', 'which', 'while',
      'would', 'could', 'should', 'about'
    ];
      
    // Count word frequencies
    const wordFrequency = {};
    words.forEach(word => {
      if (!stopWords.includes(word)) {
        wordFrequency[word] = (wordFrequency[word] || 0) + 1;
      }
    });
    
    // Sort by frequency and limit to requested count
    return Object.entries(wordFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([word, frequency]) => ({
        word,
        score: frequency / words.length
      }));
  }

  /**
   * Get a summary of the document
   * @param {number} maxLength - Maximum length in characters
   * @returns {string} - Document summary
   */
  getSummary(maxLength = 200) {
    // In a real implementation, use a summarization algorithm
    if (this.content.length <= maxLength) {
      return this.content;
    }
    
    return this.content.substring(0, maxLength).trim() + '...';
  }

  /**
   * Create a document from raw data
   * @param {Object} data - Raw document data
   * @returns {Document} - Document instance
   */
  static fromData(data) {
    return new Document(data);
  }
  
  /**
   * Create sample documents for testing
   * @param {number} count - Number of documents to create
   * @returns {Array} - Array of Document instances
   */
  static createSamples(count = 5) {
    const topics = [
      {
        domain: 'Art History',
        content: `The Renaissance was a period in European history marking the transition from the Middle Ages to modernity and covering the 15th and 16th centuries. In addition to the standard periodization, proponents of a "long Renaissance" may put its beginning in the 14th century and its end in the 17th century. The traditional view focuses more on the early modern aspects of the Renaissance and argues that it was a break from the past, but many historians today focus more on its medieval aspects and argue that it was an extension of the Middle Ages.`
      },
      {
        domain: 'Physics',
        content: `Quantum mechanics is a fundamental theory in physics that provides a description of the physical properties of nature at the scale of atoms and subatomic particles. It is the foundation of all quantum physics including quantum chemistry, quantum field theory, quantum technology, and quantum information science. Classical physics, the collection of theories that existed before the advent of quantum mechanics, describes many aspects of nature at an ordinary (macroscopic) scale, but is not sufficient for describing them at small (atomic and subatomic) scales.`
      },
      {
        domain: 'Computer Science',
        content: `Machine learning is the study of computer algorithms that can improve automatically through experience and by the use of data. It is seen as a part of artificial intelligence. Machine learning algorithms build a model based on sample data, known as training data, in order to make predictions or decisions without being explicitly programmed to do so. Machine learning algorithms are used in a wide variety of applications, such as in medicine, email filtering, speech recognition, and computer vision, where it is difficult or unfeasible to develop conventional algorithms to perform the needed tasks.`
      },
      {
        domain: 'Literature',
        content: `Modernist literature was a predominantly English genre of fiction writing, popular from roughly the 1910s into the 1960s. Modernist literature came into its own due to increasing industrialization and globalization. New technology and the horrifying events of both World Wars made many people question the future of humanity: What was becoming of the world? Modernist writing is highly self-conscious and experimental in nature. The authors of this period were interested in creating new ways of expressing ideas and emotions through language and form.`
      },
      {
        domain: 'Economics',
        content: `Behavioral economics studies the effects of psychological, cognitive, emotional, cultural and social factors on the decisions of individuals and institutions and how those decisions vary from those implied by classical economic theory. Behavioral economics is primarily concerned with the bounds of rationality of economic agents. Behavioral models typically integrate insights from psychology, neuroscience and microeconomic theory. The study of behavioral economics includes how market decisions are made and the mechanisms that drive public choice.`
      },
      {
        domain: 'Philosophy',
        content: `Existentialism is a form of philosophical inquiry that explores the problem of human existence and centers on the subjective experience of thinking, feeling, and acting. In the view of the existentialist, the individual's starting point has been called "the existential angst," a sense of disorientation, confusion, or dread in the face of an apparently meaningless or absurd world. Existentialist thinkers frequently explore issues related to the meaning, purpose, and value of human existence.`
      },
      {
        domain: 'Biology',
        content: `Genetics is a branch of biology concerned with the study of genes, genetic variation, and heredity in organisms. Though heredity had been observed for millennia, Gregor Mendel, Moravian scientist and Augustinian friar working in the 19th century in Brno, was the first to study genetics scientifically. Mendel studied "trait inheritance," patterns in the way traits are handed down from parents to offspring over time. He observed that organisms (pea plants) inherit traits by way of discrete "units of inheritance".`
      }
    ];
    
    // Ensure we don't request more samples than we have topics
    const sampleCount = Math.min(count, topics.length);
    
    return topics.slice(0, sampleCount).map((topic, index) => {
      return new Document({
        id: `sample-${index + 1}`,
        title: topic.domain,
        content: topic.content,
        metadata: {
          domain: topic.domain,
          created: new Date().toISOString(),
          sampleData: true
        }
      });
    });
  }
}

export default Document; 