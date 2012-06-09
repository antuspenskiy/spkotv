/*
 * HTRAF Toolkit
 * Copyright (c) 2011 Prometheus Research
 * Released under dual MIT/GPL license; see `LICENSE` for details
 */

(function($, undefined) {

$.htraf.plugin.table = {
    preBeforeLoad: function() {
    },

    postBeforeLoad: function() {
    
    },

    preAfterLoad: function() {
    },

    postAfterLoad: function() {
        var $el = this.element,
            data = this.data;

        /* 
         * data structure is:
         * {
         *   headers: [{title: '', domain: (number, string, date etc)}, ... {}]
         *   data: [[value1, value2, ..., valueN], ..., []]
         * }
         *
         */

        // Highlighting
        function evalExpr(expr, row) {
            var vars = [];
            $.each(data.headers, function(i, header) {
                if(/^[a-z_]\w+$/i.test(header.title))
                    vars.push(header.title +  '=' + JSON.stringify(row[i])); 
            });
            var code = 'var ' + vars.join(',') + ';'
                + 'try { return (' + expr + '); }' 
                + 'catch(_) { return false; };';
            return (new Function(code)).call();
        }

        if($el.attr('data-rowhighlight-condition')) {
            var expr = $el.attr('data-rowhighlight-condition'),
                cls = $el.attr('data-rowhighlight-class') 
                      || 'htraf-row-highlight';
            $el.find('tr').each(function(i) {
                if(evalExpr(expr, data.data[i]))
                    $(this).addClass(cls);
                else
                    $(this).removeClass(cls);
            });
        }

        // Convert table columns of named like_to_ into links when
        // data values are of form link_name|link_href
        $el.find("th").each(function(i) {
                      
            if ( $(this).text().indexOf('link_to_') != -1 )
            {
                $(this).text($(this).text().substring($(this).text().indexOf('link_to_')+8));
                selector = "td:nth-child("+(i+1)+")";
                $el.find(selector).each(function(e) {
                    if ( $(this).text().indexOf('|') != -1 )
                    {
                        $(this).html('<a href="'+$(this).text().substring($(this).text().indexOf('|')+1)+'">'+$(this).text().substring(0,$(this).text().indexOf('|'))+'</a>');
                    }
                });
            }
        });

        
    }
};


})(jQuery);




// Misc functions


// hide column in tables
function hideCol(id,col)
{ 
    selector = "#" + id + ' td:nth-child('+col+')';
    $(selector).hide();
    selector = "#" + id + ' th:nth-child('+col+')';
    $(selector).hide();
}
    
// right align column in tables
function alignCol(id,col)
{ 
    selector = "#" + id + ' td:nth-child('+col+')';
    $(selector).css("text-align","right");
    selector = "#" + id + ' th:nth-child('+col+')';
    $(selector).css("text-align","right");
}


// Add column totals to tables
function colTotals(id,cols)
{

    selector = "#" + id + " tbody tr";
    for (i in cols)
    {
        tot = 0;
        dollars = false;
        $(selector).children("td:nth-child(" + cols[i] + ")")
        .each(function() {
            if ($(this).html().indexOf('$')>=0)
                dollars = true;
            fl = isFloat( $(this).html().replace('$','').replace(/,/g,''));
            if ( fl ) {
                tot += parseFloat($(this).html().replace('$','').replace(/,/g,''));
            } else {
                tot += parseInt($(this).html().replace('$','').replace(/,/g,''));
            }
        });
        
        tot = (isFloat(tot)) ? tot.toFixed(2) : tot;
        tot = addCommas(tot);
        if (dollars)
            tot = '$'+tot;

        selector2 = "#" + id + " tfoot th:nth-child(" + cols[i] + ")";
        alert(tot);
        $(selector2).html(tot);

    }

}

// used by colTotals
function isFloat(x)
{
    if (x == parseInt(x) && x == parseFloat(x)) 
    {
        return false;
    } 
    else if (x == parseFloat(x)) 
    {
        return true;
    } 
    else 
        return false;
}

// used by colTotals
function addCommas(nStr)
{
	nStr += '';
	x = nStr.split('.');
	x1 = x[0];
	x2 = x.length > 1 ? '.' + x[1] : '';
	var rgx = /(\d+)(\d{3})/;
	while (rgx.test(x1)) {
		x1 = x1.replace(rgx, '$1' + ',' + '$2');
	}
	return x1 + x2;
}

// End add column totals to tables



