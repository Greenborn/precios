/**
 * Test: reglas de contraseña (back/helpers/password_reglas.js)
 *
 * Valida que:
 * 1. Contraseñas válidas (8 a 128 caracteres, letra y número) no devuelven error.
 * 2. Contraseñas inválidas devuelven el mensaje de la primera regla incumplida:
 *    requerida, muy corta, muy larga, sin letra, sin número.
 * 3. Email y nombre no se aceptan como contraseña (sin distinguir mayúsculas).
 * 4. La coincidencia pass / pass_repeat se controla en PUT /admin/user/cambiar_password
 *    (ruta con sesión; no se prueba acá, ver "Pendiente con base de datos").
 *
 * Uso: node test_password_reglas.js
 * No requiere base de datos ni .env.
 *
 * Pendiente con base de datos / sesión (no se ejecuta acá):
 *  - PUT /admin/user/cambiar_password: sin sesión -> DO_LOGIN; pass_repeat distinto -> error;
 *    contraseña válida -> 200 y hash bcrypt guardado en usuarios.pass (no la clave en claro).
 *  - PUT /admin/user/guardar_config: ya no acepta `pass` (se ignora) y valida nombre/email.
 */

const { validar_password, LONGITUD_MIN, LONGITUD_MAX } = require('./helpers/password_reglas')

let fallos = 0
let pruebas = 0

function esperar(nombre, condicion, detalle = '') {
    pruebas++
    if (condicion) console.log(`   ✓ ${nombre}`)
    else {
        fallos++
        console.log(`   ✗ ${nombre} ${detalle}`)
    }
}

const usuario = { email: 'ana2026@example.com', name: 'Ana' }

function parte_validas() {
    console.log('\n1. Contraseñas válidas')
    const validas = [
        'abcdefg1',                       // mínimo: 8 caracteres, letra y número
        'Clave2026',
        '1234abcd',                       // número antes que letra
        'x'.repeat(127) + '1',            // 128 caracteres
        'Segura#99!',
    ]
    for (const pass of validas) {
        const e = validar_password(pass, usuario)
        esperar(`acepta "${pass.length > 20 ? pass.slice(0, 10) + '…' : pass}" (${pass.length} car.)`, e === null, `-> ${e}`)
    }
}

function parte_invalidas() {
    console.log('\n2. Contraseñas inválidas (mensaje de la regla incumplida)')
    const casos = [
        [undefined, 'requerida'],
        [null, 'requerida'],
        [12345678, 'requerida'],                  // no es string
        ['', 'al menos 8'],
        ['abc1234', 'al menos 8'],                // 7 caracteres
        ['abcdefgh', 'al menos un número'],       // sólo letras
        ['12345678', 'al menos una letra'],       // sólo números
        ['x'.repeat(LONGITUD_MAX) + '1', 'no puede superar 128'], // 129 caracteres
    ]
    for (const [pass, esperado] of casos) {
        const e = validar_password(pass, usuario)
        const etiqueta = typeof pass === 'string' && pass.length <= 12 ? `"${pass}"` : `(${typeof pass}, ${String(pass).length} car.)`
        esperar(`rechaza ${etiqueta} (${esperado})`, typeof e === 'string' && e.includes(esperado), `-> ${e}`)
    }
    esperar(`longitudes de referencia: min ${LONGITUD_MIN}, max ${LONGITUD_MAX}`, LONGITUD_MIN === 8 && LONGITUD_MAX === 128)
}

function parte_email_nombre() {
    console.log('\n3. Email y nombre no pueden ser la contraseña')
    const e1 = validar_password('ana2026@example.com', usuario)
    esperar('rechaza el email como contraseña', typeof e1 === 'string' && e1.includes('email'), `-> ${e1}`)

    const e2 = validar_password('ANA2026@EXAMPLE.COM', usuario)
    esperar('rechaza el email en mayúsculas (case-insensitive)', typeof e2 === 'string' && e2.includes('email'), `-> ${e2}`)

    const e3 = validar_password('ANA12345', { email: 'x@y.com', name: 'ana12345' })
    esperar('nombre igual a la contraseña se rechaza (case-insensitive)', typeof e3 === 'string' && e3.includes('nombre'), `-> ${e3}`)

    const e5 = validar_password('Ana12345', { email: 'x@y.com', name: 'Juan' })
    esperar('contraseña que sólo contiene el nombre no se rechaza', e5 === null, `-> ${e5}`)

    const e6 = validar_password('Clave2026', {})
    esperar('sin email/nombre informados no falla', e6 === null, `-> ${e6}`)
}

function main() {
    console.log('='.repeat(70))
    console.log('TEST: Reglas de contraseña (helpers/password_reglas.js)')
    console.log('='.repeat(70))

    parte_validas()
    parte_invalidas()
    parte_email_nombre()

    console.log(`\nResultado: ${pruebas - fallos}/${pruebas} pruebas OK`)
    process.exit(fallos ? 1 : 0)
}

main()
