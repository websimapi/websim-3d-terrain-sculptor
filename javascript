        import { createNoise2D } from 'https://esm.sh/simplex-noise@4.0.1';

        import * as THREE from 'three';
        import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
        import { createNoise2D } from 'simplex-noise';

// ...
import { createNoise2D } from 'simplex-noise';
// ...

/* Inside setupInteraction */
// We need to handle the case where the user taps on a button.
// The UI layer has pointer-events: none, but buttons have pointer-events: auto.
// This is handled by CSS. 
// However, if I touch a button, does the canvas get the event?
// The canvas is behind. DOM events propagate. 
// e.stopPropagation() on buttons is handled by standard button behavior usually?
// Actually, I should ensure UI clicks don't sculpt.
// The UI is in a separate div on top. If I click a button, the event target is the button.
// My canvas listener is on #canvas-container. 
// Does a touch on a button propagate to canvas-container behind it?
// Yes, if they overlap. But #canvas-container is a sibling?
// No, body > canvas-container, body > ui-layer.
// They are siblings.
// Events bubble up to body. 
// If I attach listeners to canvas-container, and the button is in ui-layer (visually on top), 
// clicking the button hits the button. It does NOT hit the canvas-container because they are siblings 
// and the button obscures the canvas VISUALLY, but in DOM structure...
// Wait, `canvas-container` is `width: 100vw; height: 100vh`.
// `ui-layer` is `position: absolute; top: 0`.
// If I tap a button, the target is the button. The event bubbles to ui-layer, then body.
// It does NOT go to canvas-container.
// So UI interaction is safe.

<<<<<<< SEARCH
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
=======
// removed
>>>>>>> REPLACE

