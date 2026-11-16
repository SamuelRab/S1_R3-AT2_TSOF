import app from '../src/app.js';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearDatabase } from './utils/clearDatabase.js';
import { MontadoraFactory } from './factories/MontadoraFactory.js';
import { ClienteFactory } from './factories/ClienteFactory.js';
import { consultarCep } from '../src/utils/consultarCep.js';
import { connection } from '../src/configs/Database.js';

vi.mock('../src/utils/consultarCep.js', () => ({
    consultarCep: vi.fn()
}));

const cepMock = {
    cep: '01001000',
    logradouro: 'Praça da Sé',
    bairro: 'Sé',
    cidade: 'São Paulo',
    uf: 'SP'
};

describe('Testes de integração - rotas e fluxos', () => {
    beforeEach(async () => {
        await clearDatabase();
        vi.mocked(consultarCep).mockResolvedValue(cepMock);
    });

    afterEach(async () => {
        await clearDatabase();
        vi.clearAllMocks();
    });

    afterAll(async () => {
        await connection.end();
    });

    describe('Montadoras', () => {
        it('deve criar, listar, atualizar e deletar uma montadora', async () => {
            const createRes = await request(app).post('/montadoras').send({
                nome: 'Toyota',
                pais: 'Japão'
            });

            expect(createRes.status).toBe(201);
            expect(createRes.body.data).toHaveProperty('insertId');
            const id = createRes.body.data.insertId;

            const listRes = await request(app).get('/montadoras');
            expect(listRes.status).toBe(200);
            expect(Array.isArray(listRes.body.data)).toBe(true);
            expect(listRes.body.data.some((m) => m.Id === id)).toBe(true);

            const updateRes = await request(app)
                .put('/montadoras')
                .query({ id })
                .send({ nome: 'Toyota Atualizada', pais: 'Japão' });
            expect(updateRes.status).toBe(200);
            expect(updateRes.body.data.affectedRows).toBe(1);

            const deleteRes = await request(app).delete(`/montadoras/${id}`);
            expect(deleteRes.status).toBe(200);
            expect(deleteRes.body.data.affectedRows).toBe(1);

            const listAfter = await request(app).get('/montadoras');
            expect(listAfter.body.data.some((m) => m.Id === id)).toBe(false);
        });

        it('deve retornar 404 ao atualizar ou deletar montadora inexistente', async () => {
            const updateRes = await request(app)
                .put('/montadoras')
                .query({ id: 999999 })
                .send({ nome: 'Inexistente', pais: 'XX' });
            expect(updateRes.status).toBe(404);

            const deleteRes = await request(app).delete('/montadoras/999999');
            expect(deleteRes.status).toBe(404);
        });
    });

    describe('Clientes', () => {
        const payloadCliente = {
            nome: 'João da Silva',
            cpf: '123.456.789-00',
            cep: '01001-000',
            numero: '100',
            complemento: 'Apto 1'
        };

        it('deve criar, listar, atualizar e deletar um cliente', async () => {
            const createRes = await request(app).post('/clientes').send(payloadCliente);

            expect(createRes.status).toBe(201);
            expect(createRes.body.data).toHaveProperty('insertId');
            expect(consultarCep).toHaveBeenCalled();
            const id = createRes.body.data.insertId;

            const listRes = await request(app).get('/clientes');
            expect(listRes.status).toBe(200);
            expect(Array.isArray(listRes.body.data)).toBe(true);
            expect(listRes.body.data.some((c) => c.Id === id)).toBe(true);

            const updateRes = await request(app)
                .put('/clientes')
                .query({ id })
                .send({ ...payloadCliente, nome: 'João Atualizado', numero: '200' });
            expect(updateRes.status).toBe(200);
            expect(updateRes.body.data.affectedRows).toBe(1);

            const deleteRes = await request(app).delete(`/clientes/${id}`);
            expect(deleteRes.status).toBe(200);
            expect(deleteRes.body.data.affectedRows).toBe(1);

            const listAfter = await request(app).get('/clientes');
            expect(listAfter.body.data.some((c) => c.Id === id)).toBe(false);
        });
    });

    describe('Veículos', () => {
        it('deve criar, listar, atualizar e deletar um veículo', async () => {
            const montadora = await MontadoraFactory.create('Honda', 'Japão');
            const cliente = await ClienteFactory.create(
                'Maria Souza',
                '98765432100',
                '01001000',
                'Praça da Sé',
                'Sé',
                'São Paulo',
                'SP',
                '50',
                null
            );

            const createRes = await request(app).post('/veiculos').send({
                idMontadora: montadora.Id,
                idCliente: cliente.id,
                modelo: 'Civic',
                placa: 'ABC1D23',
                ano: 2022,
                cor: 'Preto',
                valor: 120000
            });

            expect(createRes.status).toBe(201);
            expect(createRes.body.data).toHaveProperty('insertId');
            const id = createRes.body.data.insertId;

            const listRes = await request(app).get('/veiculos');
            expect(listRes.status).toBe(200);
            expect(Array.isArray(listRes.body.data)).toBe(true);
            expect(listRes.body.data.some((v) => v.Id === id)).toBe(true);

            const updateRes = await request(app)
                .put('/veiculos')
                .query({ id })
                .send({
                    idMontadora: montadora.Id,
                    idCliente: cliente.id,
                    modelo: 'Civic Touring',
                    placa: 'ABC1D23',
                    ano: 2023,
                    cor: 'Branco',
                    valor: 130000
                });
            expect(updateRes.status).toBe(200);
            expect(updateRes.body.data.affectedRows).toBe(1);

            const deleteRes = await request(app).delete(`/veiculos/${id}`);
            expect(deleteRes.status).toBe(200);
            expect(deleteRes.body.data.affectedRows).toBe(1);

            const listAfter = await request(app).get('/veiculos');
            expect(listAfter.body.data.some((v) => v.Id === id)).toBe(false);
        });
    });

    describe('Fluxos de uso', () => {
        it('deve executar fluxo completo: cadastrar montadora, cliente e veículo e listar vínculos', async () => {
            const montadoraRes = await request(app).post('/montadoras').send({
                nome: 'Ford',
                pais: 'EUA'
            });
            expect(montadoraRes.status).toBe(201);
            const montadoraId = montadoraRes.body.data.insertId;

            const clienteRes = await request(app).post('/clientes').send({
                nome: 'Carlos Pereira',
                cpf: '111.222.333-44',
                cep: '01001000',
                numero: '10',
                complemento: ''
            });
            expect(clienteRes.status).toBe(201);
            const clienteId = clienteRes.body.data.insertId;

            const veiculoRes = await request(app).post('/veiculos').send({
                idMontadora: montadoraId,
                idCliente: clienteId,
                modelo: 'Focus',
                placa: 'XYZ9K88',
                ano: 2020,
                cor: 'Prata',
                valor: 75000
            });
            expect(veiculoRes.status).toBe(201);
            const veiculoId = veiculoRes.body.data.insertId;

            const veiculosRes = await request(app).get('/veiculos');
            expect(veiculosRes.status).toBe(200);
            const veiculo = veiculosRes.body.data.find((v) => v.Id === veiculoId);
            expect(veiculo).toBeTruthy();
            expect(veiculo.IdMontadora).toBe(montadoraId);
            expect(veiculo.IdCliente).toBe(clienteId);
            expect(veiculo.Montadora).toBe('Ford');
            expect(veiculo.Cliente).toBe('Carlos Pereira');
        });
    });
});