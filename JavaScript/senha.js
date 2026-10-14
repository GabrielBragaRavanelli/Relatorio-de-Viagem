/**
 * AJBorges - Regras de senha do Portal da Frota
 *
 * A senha precisa ter:
 *   - os 6 primeiros dígitos do CPF do motorista
 *   - pelo menos 1 caractere especial (@ # $ ! ...)
 *   - uma palavra com pelo menos 4 letras
 *   - no mínimo 11 caracteres
 *
 * A mesma regra é conferida no servidor (edge function solicitar-cadastro).
 */
(function () {
    const REGEX_ESPECIAL = /[!@#$%^&*(),.?":{}|<>_\-+=\\/\[\]]/;
    const REGEX_PALAVRA = /[A-Za-zÀ-ÿ]{4,}/;

    function seisDigitos(cpf) {
        return String(cpf || '').replace(/\D/g, '').slice(0, 6);
    }

    /** Retorna o estado de cada regra (para a lista de conferência na tela). */
    function regras(senha, cpf) {
        const s = String(senha || '');
        const prefixo = seisDigitos(cpf);
        return {
            tamanho: s.length >= 11 && s.length <= 72,
            cpf: prefixo.length === 6 ? s.includes(prefixo) : null, // null = CPF ainda não informado
            especial: REGEX_ESPECIAL.test(s),
            palavra: REGEX_PALAVRA.test(s)
        };
    }

    /** Primeira regra não atendida, em texto, ou null se a senha está ok. */
    function erro(senha, cpf) {
        const r = regras(senha, cpf);
        if (!r.tamanho) return 'A senha precisa ter pelo menos 11 caracteres.';
        if (r.cpf === null) return 'Informe o CPF antes de criar a senha.';
        if (!r.cpf) return 'A senha precisa conter os 6 primeiros dígitos do seu CPF.';
        if (!r.especial) return 'A senha precisa de um caractere especial (como @, #, $ ou !).';
        if (!r.palavra) return 'A senha precisa de uma palavra com pelo menos 4 letras.';
        return null;
    }

    /** Os 3 exemplos da dica, montados com os 6 primeiros dígitos do CPF. */
    function exemplos(cpf) {
        const p = seisDigitos(cpf).padEnd(6, '0') || '123456';
        return [`@${p}Rota`, `Frota#${p}`, `Viagem${p}!`];
    }

    window.ajbSenha = { regras, erro, exemplos, seisDigitos };
})();
