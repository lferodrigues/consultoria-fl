// Todas as fotos enviadas pela plataforma (perfil, capa, ficha de inscrição, avaliação, vitrine)
// são gravadas em WebP: bem mais leves que JPEG com a mesma qualidade.
// Navegadores antigos que não geram WebP (ex.: Safari antes do iOS 14) recebem JPEG, para o envio nunca falhar.
export function canvasParaImagem(canvas, qualidade = 0.82) {
    const webp = canvas.toDataURL("image/webp", qualidade);
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", qualidade);
}
