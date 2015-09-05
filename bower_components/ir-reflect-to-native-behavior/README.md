# ir-reflect-to-native-behavior

**Polymer 1.0 behavior to enable custom web component submission as a field in a native html form.**

You might have been puzzled about how exactly a non-native component may be submitted as part of a static form. 
You might also be aware that it's not possibble to append child elements to input elements. 
Thus it's not possible to enrich an input with shadow dom.

ir-reflect-to-native-behavior solves this by adding a hidden native input to the form it belongs to, and reflecting its 
`.value` property to the hidden field. The name of the hidden input field is determined by the host's .name property. 
The hidden input is thus submitted as part of the native form under the given name, and provides the developer with
an element that feels totally like any input element.

## How it works
- In the `attached` lifecycle phase a hidden input element is created in the host's Light DOM.
- A two-way bound `.value` property is added to the host. When the host updates `.value`.
it is reflected to the hidden native input element's `value` attribute.

## Usage
- Simple: Assign to `.value` when host's "output" value changes and don't worry about the rest.
- Advanced: Observe `.value` to update host's internal state.

**Note:**
It is the responsibility of the host element developer to update `.value`. The behavior has no built-in magic to know what
the element author wants to achieve. This stands for the initialization (ready/attached) and any later phases 
(changes in component's internal state).

## To-do
- Demo
- I'll appreciate some feedback on whether the **name** of `.value` property on the host should be customizeable.
A gut feeling is telling me it could sometimes interfere with other elements' `.value`, but haven't (yet) met a usecase that would
justify this change.

## Where it is used so far:
- ir-select [https://github.com/IgorRubinovich/ir-select](https://github.com/IgorRubinovich/ir-select)
- ir-filebrowser [https://github.com/IgorRubinovich/ir-filebrowser](https://github.com/IgorRubinovich/ir-filebrowser)

## License
[MIT](http://opensource.org/licenses/MIT) 