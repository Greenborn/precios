"""Test de las reglas del consumidor, sin base de datos ni servicios:
no escribe precios en sucursales de negocio ni admite fechas posteriores a mañana.

Uso: extra_services/venv/bin/python extra_services/test_reglas_importacion.py
"""
import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from unittest import mock

sys.dont_write_bytecode = True
import actualizar_precios as ap

COMUN, NEGOCIO = 1, 2


def dia(delta):
    return (datetime.now(ap.ZONA_ARGENTINA) + timedelta(days=delta)).strftime('%Y-%m-%d')


class Cursor:
    def __init__(self):
        self.consultas = []

    def execute(self, sql, params=None):
        self.consultas.append((' '.join(sql.split()), params))

    def fetchone(self):
        sql, params = self.consultas[-1]
        if 'FROM branch ' in sql:
            return (7,) if int(params[0]) == NEGOCIO else (None,)
        return None

    def close(self):
        pass


class Conexion:
    def __init__(self):
        self.cur = Cursor()

    def cursor(self):
        return self.cur

    def commit(self):
        raise AssertionError('no debe escribir')

    def close(self):
        pass

    def rollback(self):
        pass

    def is_connected(self):
        return True


def articulo(branch_id, fecha):
    return {'name': 'Arroz', 'category_name': 'Almacen', 'price': 10,
            'branch_id': branch_id, 'fecha_registro': fecha}


class Reglas(unittest.TestCase):
    def test_fechas(self):
        # 01:30 UTC del 28 es todavia el 27 en Argentina
        ahora = datetime(2026, 11, 28, 1, 30, tzinfo=timezone.utc)
        for x in ('2026-11-27', '2026-11-28T23:59:59.123456', '2026-11-28 10:00',
                  '2026-11-29T02:59:59Z', '2020-01-01'):
            self.assertIsNone(ap.validar_fecha(x, ahora)[1], x)
        for x in ('2026-11-29', '2026-11-29T00:00:00', '2026-11-29T03:00:00Z',
                  '2026-11-28T23:00:00-05:00'):
            self.assertEqual(ap.validar_fecha(x, ahora), (None, ap.FECHA_FUTURA), x)
        for x in ('', 'abc', '27/11/2026', '2026-02-31', '2026-11-27T25:00:00', None, 5,
                  '0001-01-01T00:00:00Z'):
            self.assertEqual(ap.validar_fecha(x, ahora), (None, ap.FECHA_NO_VALIDA), x)
        self.assertEqual(ap.validar_fecha('2026-11-29T01:00:00.000Z', ahora)[0], '2026-11-28 22:00:00')
        self.assertEqual(ap.validar_fecha('2026-11-28T10:00:00', ahora)[0], '2026-11-28T10:00:00')

    def test_sucursal_de_negocio_no_escribe(self):
        conexion = Conexion()
        with mock.patch.object(ap, 'obtener_conexion', return_value=conexion), \
                mock.patch.object(ap, 'procesa_precio') as precio, \
                mock.patch.object(ap, 'get_producto') as producto:
            r = ap.procesar_articulo(articulo(NEGOCIO, dia(0)))
        self.assertFalse(r['stat'])
        self.assertTrue(ap.es_error_permanente(r['text']), r['text'])
        precio.assert_not_called()
        producto.assert_not_called()
        self.assertEqual([c[0].split()[0] for c in conexion.cur.consultas], ['SELECT'])

    def test_sucursal_comun_sigue_el_flujo(self):
        conexion = Conexion()
        with mock.patch.object(ap, 'obtener_conexion', return_value=conexion), \
                mock.patch.object(ap, 'resolver_nombre_canonico', side_effect=lambda n: n), \
                mock.patch.object(ap, 'get_producto', return_value=None) as producto, \
                mock.patch.object(ap, 'get_categoria', return_value=None):
            ap.procesar_articulo(articulo(COMUN, dia(1)))
        producto.assert_called_once()

    def test_fecha_futura_no_toca_la_base(self):
        with mock.patch.object(ap, 'obtener_conexion') as conectar:
            for r in (ap.procesar_articulo(articulo(COMUN, dia(2))),
                      ap.procesar_articulo({**articulo(COMUN, None)}, dia(2)),
                      ap.procesar_oferta({'titulo': 't', 'precio': 1, 'branch_id': COMUN,
                                          'url': 'u', 'fecha_registro': dia(2)})):
                self.assertFalse(r['stat'])
                self.assertIn('posterior a mañana', r['text'])
                self.assertTrue(ap.es_error_permanente(r['text']))
        conectar.assert_not_called()


if __name__ == '__main__':
    unittest.main()
