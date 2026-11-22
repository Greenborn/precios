
exports.limpiarTexto = (texto) => {
    const REPLACES = [['á', 'a'],['é', 'e'],['í', 'i'],['ó', 'o'],['ú', 'u']]
    texto = texto.replace(/[;{}()\*/\\`'"]/g, '');
    texto = texto.replace(/[\r\n]/g, '');
    texto = texto.replace(/\s+/g, ' ');
    // minúsculas antes de quitar acentos (para cubrir Á, É...) y todas las apariciones
    texto = texto.toLowerCase();
    for (let i = 0; i < REPLACES.length; i++) 
        texto = texto.replaceAll(REPLACES[i][0], REPLACES[i][1])
    texto = texto.trim();
    return texto;
}