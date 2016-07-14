'use strict';

const JsonML = require('jsonml.js/lib/dom');

let isTHead = false;

function transformTHead(node) {
  const transformedNode = transformer(node);
  isTHead = false;
  return transformedNode;
}

const selfClosing = ['!', 'img', 'link', 'hr', 'br'];

function isClosing(htmlValue, tagName) {
  if (tagName) {
    return new RegExp('^</' + tagName + '>$').test(htmlValue);
  }
  let tag = htmlValue.match(/^<(!|[a-zA-Z]+).*?\/?>/);
  tag = tag && tag[1];
  if (tag && selfClosing.indexOf(tag) === -1) {
    const closeTag = new RegExp('</' + tag + '>$');
    const close = closeTag.test(htmlValue);
    return close;
  }
  return true;
}

function transformer(node, index) {
  if (node == null) return;

  if (Array.isArray(node)) {
    return node.map(transformer, index);
  }

  const transformedChildren = node.type === 'table' ?
    transformer(node.children.slice(1)) :
    transformer(node.children);

  switch (node.type) {
    case 'root':
      return ['article'].concat(transformedChildren);
    case 'heading':
      return [`h${node.depth}`].concat(transformedChildren);
    case 'text':
      return node.value;
    case 'list':
      return [node.ordered ? 'ol' : 'ul'].concat(transformedChildren);
    case 'listItem':
      return ['li'].concat(transformedChildren);
    case 'paragraph':
      return ['p'].concat(transformedChildren);
    case 'link':
      return ['a', {
        title: node.title,
        href: node.url,
      }].concat(transformedChildren);
    case 'image':
      return ['img', {
        title: node.title,
        src: node.url,
        alt: node.alt,
      }];
    case 'table':
      isTHead = true;
      return [
        'table', ['thead', transformTHead(node.children[0])],
        ['tbody'].concat(transformedChildren),
      ];
    case 'tableRow':
      return ['tr'].concat(transformedChildren);
    case 'tableCell':
      return [isTHead ? 'th' : 'td'].concat(transformedChildren);
    case 'emphasis':
      return ['em'].concat(transformedChildren);
    case 'strong':
      return ['strong'].concat(transformedChildren);
    case 'inlineCode':
      return ['code', node.value];
    case 'code':
      return ['pre', { lang: node.lang },
        ['code', node.value],
      ];
    case 'blockquote':
      return ['blockquote'].concat(transformedChildren);
    case 'thematicBreak':
      return ['hr'];
    case 'html':
      const tagClosed = isClosing(node.value);
      const htmlMT = JsonML.fromHTMLText(node.value);
      if (!tagClosed) {
        htmlMT.push('__tag_content_placeholder__');
      }
      return htmlMT;
    case 'linkReference':
      return `[${node.identifier}]`;
    default:
      return node;
  }
}

let placeholderParent;
// replace __tag_content_placeholder__
function placeholderReplace(item, index) {
  if (Array.isArray(item)) {
    item.forEach(placeholderReplace.bind(item));
  } else if (placeholderParent) {
    placeholderParent.push(item);
    this.splice(index, 1);
    placeholderParent = null;
  } else if (item === '__tag_content_placeholder__') {
    placeholderParent = this;
    this.splice(index, 1);
  }
}

// filter empty tag
function filterEmpty(item, index) {
  if (Array.isArray(item)) {
    if (item[0] === '') {
      this.splice(index, 1);
    } else {
      item.forEach(filterEmpty.bind(item));
    }
  }
}

module.exports = function(ast) {
  let markdownData = transformer(ast);
  markdownData.forEach(placeholderReplace.bind(markdownData));
  markdownData.forEach(filterEmpty.bind(markdownData));
  return markdownData;
};
