function cleanTiptapContent(node: any): any {
  if (!node || typeof node !== 'object') {
    return node;
  }

  // If it's a text node with empty text, return null to remove it
  if (node.type === 'text' && (!node.text || node.text.trim() === '')) {
    return null;
  }

  // If node has content array, clean it recursively
  if (Array.isArray(node.content)) {
    node.content = node.content
      .map(child => cleanTiptapContent(child))
      .filter(child => child !== null); // Remove null entries
    
    // If content array is now empty, remove it
    if (node.content.length === 0) {
      delete node.content;
    }
  }

  return node;
}

export default cleanTiptapContent