import { hydrate_nodes, hydrate_nodes_to_array, hydrate_start, hydrating } from './hydration.js';
import { clone_node, empty } from './operations.js';
import { create_fragment_from_html } from './reconciler.js';
import { current_effect } from '../runtime.js';
import { TEMPLATE_FRAGMENT, TEMPLATE_USE_IMPORT_NODE } from '../../../constants.js';
import { effect } from '../reactivity/effects.js';
import { is_array } from '../utils.js';

/**
 * @deprecated
 * @param {boolean} is_fragment
 */
function get_hydrate_nodes(is_fragment) {
	// TODO get rid of this, just have start/end on effects
	if (is_fragment) {
		return hydrate_nodes_to_array();
	}

	return hydrate_start;
}

/**
 * @template {import("#client").TemplateNode | import("#client").TemplateNode[]} T
 * @param {T} dom
 * @param {import("#client").Effect} effect
 * @returns {T}
 */
export function push_template_node(
	dom,
	effect = /** @type {import('#client').Effect} */ (current_effect)
) {
	if (hydrating && effect.d1 === null) {
		effect.d1 = is_array(dom) ? dom[0] : dom;
		effect.d2 = is_array(dom) ? dom[dom.length - 1] : dom;
	}

	return dom;
}

/**
 * @param {string} content
 * @param {number} flags
 * @returns {() => Node | Node[]}
 */
/*#__NO_SIDE_EFFECTS__*/
export function template(content, flags) {
	var is_fragment = (flags & TEMPLATE_FRAGMENT) !== 0;
	var use_import_node = (flags & TEMPLATE_USE_IMPORT_NODE) !== 0;

	/** @type {Node} */
	var node;

	return () => {
		if (hydrating) {
			return push_template_node(is_fragment ? hydrate_nodes : hydrate_start);
		}

		if (!node) {
			node = create_fragment_from_html(content);
			if (!is_fragment) node = /** @type {Node} */ (node.firstChild);
		}
		var clone = use_import_node ? document.importNode(node, true) : clone_node(node, true);

		push_template_node(
			is_fragment
				? /** @type {import('#client').TemplateNode[]} */ ([...clone.childNodes])
				: /** @type {import('#client').TemplateNode} */ (clone)
		);

		return clone;
	};
}

/**
 * @param {string} content
 * @param {number} flags
 * @returns {() => Node | Node[]}
 */
/*#__NO_SIDE_EFFECTS__*/
export function template_with_script(content, flags) {
	var first = true;
	var fn = template(content, flags);

	return () => {
		if (hydrating) return fn();

		var node = /** @type {Element | DocumentFragment} */ (fn());

		if (first) {
			first = false;
			run_scripts(node);
		}

		return node;
	};
}

/**
 * @param {string} content
 * @param {number} flags
 * @returns {() => Node | Node[]}
 */
/*#__NO_SIDE_EFFECTS__*/
export function svg_template(content, flags) {
	var is_fragment = (flags & TEMPLATE_FRAGMENT) !== 0;
	var fn = template(`<svg>${content}</svg>`, 0); // we don't need to worry about using importNode for SVGs

	/** @type {Element | DocumentFragment} */
	var node;

	return () => {
		if (hydrating) {
			return push_template_node(is_fragment ? hydrate_nodes : hydrate_start);
		}

		if (!node) {
			var svg = /** @type {Element} */ (fn());

			if ((flags & TEMPLATE_FRAGMENT) === 0) {
				node = /** @type {Element} */ (svg.firstChild);
			} else {
				node = document.createDocumentFragment();
				while (svg.firstChild) {
					node.appendChild(svg.firstChild);
				}
			}
		}

		var clone = clone_node(node, true);

		push_template_node(
			is_fragment
				? /** @type {import('#client').TemplateNode[]} */ ([...clone.childNodes])
				: /** @type {import('#client').TemplateNode} */ (clone)
		);

		return clone;
	};
}

/**
 * @param {string} content
 * @param {number} flags
 * @returns {() => Node | Node[]}
 */
/*#__NO_SIDE_EFFECTS__*/
export function svg_template_with_script(content, flags) {
	var first = true;
	var fn = svg_template(content, flags);

	return () => {
		if (hydrating) return fn();

		var node = /** @type {Element | DocumentFragment} */ (fn());

		if (first) {
			first = false;
			run_scripts(node);
		}

		return node;
	};
}

/**
 * @param {string} content
 * @param {number} flags
 * @returns {() => Node | Node[]}
 */
/*#__NO_SIDE_EFFECTS__*/
export function mathml_template(content, flags) {
	var is_fragment = (flags & TEMPLATE_FRAGMENT) !== 0;
	var fn = template(`<math>${content}</math>`, 0); // we don't need to worry about using importNode for MathML

	/** @type {Element | DocumentFragment} */
	var node;

	return () => {
		if (hydrating) {
			return push_template_node(is_fragment ? hydrate_nodes : hydrate_start);
		}

		if (!node) {
			var math = /** @type {Element} */ (fn());

			if ((flags & TEMPLATE_FRAGMENT) === 0) {
				node = /** @type {Element} */ (math.firstChild);
			} else {
				node = document.createDocumentFragment();
				while (math.firstChild) {
					node.appendChild(math.firstChild);
				}
			}
		}

		var clone = clone_node(node, true);

		push_template_node(
			is_fragment
				? /** @type {import('#client').TemplateNode[]} */ ([...clone.childNodes])
				: /** @type {import('#client').TemplateNode} */ (clone)
		);

		return clone;
	};
}

/**
 * Creating a document fragment from HTML that contains script tags will not execute
 * the scripts. We need to replace the script tags with new ones so that they are executed.
 * @param {Element | DocumentFragment} node
 */
function run_scripts(node) {
	// scripts were SSR'd, in which case they will run
	if (hydrating) return;

	const scripts =
		/** @type {HTMLElement} */ (node).tagName === 'SCRIPT'
			? [/** @type {HTMLScriptElement} */ (node)]
			: node.querySelectorAll('script');
	for (const script of scripts) {
		var clone = document.createElement('script');
		for (var attribute of script.attributes) {
			clone.setAttribute(attribute.name, attribute.value);
		}

		clone.textContent = script.textContent;
		// If node === script tag, replaceWith will do nothing because there's no parent yet,
		// waiting until that's the case using an effect solves this.
		// Don't do it in other circumstances or we could accidentally execute scripts
		// in an adjacent @html tag that was instantiated in the meantime.
		if (script === node) {
			effect(() => script.replaceWith(clone));
		} else {
			script.replaceWith(clone);
		}
	}
}

/**
 * @param {Text | Comment | Element} anchor
 */
/*#__NO_SIDE_EFFECTS__*/
export function text(anchor) {
	if (!hydrating) return push_template_node(empty());

	var node = hydrate_start;

	if (!node) {
		// if an {expression} is empty during SSR, `hydrate_nodes` will be empty.
		// we need to insert an empty text node
		anchor.before((node = empty()));
	}

	return push_template_node(node);
}

export function comment() {
	// we're not delegating to `template` here for performance reasons
	if (hydrating) {
		return push_template_node(hydrate_nodes);
	}
	var frag = document.createDocumentFragment();
	var anchor = empty();
	frag.append(anchor);
	push_template_node([anchor]);

	return frag;
}

/**
 * Assign the created (or in hydration mode, traversed) dom elements to the current block
 * and insert the elements into the dom (in client mode).
 * @param {Text | Comment | Element} anchor
 * @param {DocumentFragment | Element} dom
 */
export function append(anchor, dom) {
	if (!hydrating) {
		const effect = /** @type {import('#client').Effect} */ (current_effect);

		// TODO handle component case, where effect.d1/d2 already exist
		if (dom.nodeType === 11) {
			const d1 = empty(); // TODO do this in template creation. should d2 be an empty as well? or should we be storing the anchor?
			/** @type {import('#client').TemplateNode} */ (dom.firstChild).before(d1);
			effect.d1 = d1;
			effect.d2 = /** @type {import('#client').TemplateNode} */ (dom.lastChild);
		} else {
			effect.d1 = effect.d2 = /** @type {Element} */ (dom);
		}

		anchor.before(/** @type {Node} */ (dom));
	}
}
