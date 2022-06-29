import feather from './feather.js';

// Init feather
const F = new feather(['./templates/heading.html'], [/*CSS IMPORTS*/]) // Optinal trust key, deafult is an random uuid

// Bake template
function example(message){
    alert(message)
}

// Reuse template
F.BakeElement("heading2", {
    
}).append("#container")

