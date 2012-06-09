


$(function () {
    $('.demo-switch').click(function () {
        var text = $(this).text()
        if (text == '[+ view source]') {
            $(this).next('.demo-source').slideDown('fast');
            $(this).text('[- view source]');
        }
        else if (text == '[- view source]') {
            $(this).next('.demo-source').slideUp('fast');
            $(this).text('[+ view source]');
        }
        else if (text == '[+ view demo]') {
            $(this).next('.demo-area').slideDown('fast');
            $(this).text('[- view demo]');
        }
        else if (text == '[- view demo]') {
            $(this).next('.demo-area').slideUp('fast');
            $(this).text('[+ view demo]');
        }
    });
});


